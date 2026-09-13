#!/usr/bin/env python3
"""Publish an explicit, public field projection; credentials stay in local lark-cli."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / '.local'
BASE = os.environ.get('FEISHU_BASE_TOKEN', 'L7G1bvgFNarGcZspg5WcfXl0nrG')
TABLE = os.environ.get('FEISHU_TABLE_ID', 'tblb9DmSHARsKWaB')
FIELDS = ['作品名称', '封面', '对应视频', '参考图', '提示词', '负面提示词', '模型', '模型版本', '生成方式', '风格标签', '来源', '原始链接', '视频链接', '作者', '生成参数', '复现笔记', '状态', '收录时间']

def run_cli(args):
    env = os.environ.copy()
    for name in ['NO_PROXY', 'no_proxy']:
        env[name] = ','.join(dict.fromkeys((env.get(name, '') + ',127.0.0.1,localhost,::1').strip(',').split(',')))
    result = subprocess.run(['lark-cli', 'base', *args, '--as', 'user'], capture_output=True, text=True, env=env, cwd=ROOT)
    if result.returncode:
        # Do not print raw transport output, which may include signed URLs.
        raise RuntimeError('飞书读取失败，未更新发布快照；请检查本机 lark-cli 参数、用户登录与表格读取权限。')
    try:
        value = json.loads(result.stdout)
    except ValueError as error:
        raise RuntimeError('飞书返回了无法解析的结果，未更新网站数据。') from error
    if value.get('ok') is False:
        raise RuntimeError('飞书未确认读取成功，未更新网站数据。')
    return value

def web_url(value):
    value = (value or '').strip()
    match = re.fullmatch(r'\[[^\]]*\]\((https?://.*)\)', value)
    if match:
        value = match.group(1)
    parsed = urlparse(value)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
        return None
    # Private Feishu resources and expiring credential-bearing links never enter the catalog.
    if parsed.hostname.endswith(('feishu.cn', 'larksuite.com')) or re.search(r'(?:token|signature|sign|expires|x-amz-credential)=', parsed.query, re.I):
        return None
    return value

def public_description(notes):
    match = re.search(r'效果说明[：:]\s*(.+?)(?:\n\s*\n|$)', notes or '', re.S)
    usage = re.search(r'适合用途[：:]\s*([^\n]+)', notes or '')
    return (match.group(1).strip() if match else ''), (usage.group(1).strip() if usage else '')

def probe(file):
    if shutil.which('ffprobe'):
        result = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', str(file)], capture_output=True, text=True)
        if result.returncode == 0:
            value = json.loads(result.stdout)
            if value.get('streams'):
                stream = value['streams'][0]
                return {'width': stream['width'], 'height': stream['height'], 'duration': round(float(value.get('format', {}).get('duration', 0)), 2)}
    return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--existing-export', action='store_true', help='Use the already verified local export for this run')
    parser.add_argument('--seed-cache', type=Path)
    parser.add_argument('--seed-records', type=Path)
    args = parser.parse_args()
    PRIVATE.mkdir(exist_ok=True)
    records_file = PRIVATE / 'records.ndjson'
    if not args.existing_export:
        cli_args = ['+record-list', '--base-token', BASE, '--table-id', TABLE, '--format', 'ndjson', '--output', str(records_file.relative_to(ROOT)), '--overwrite']
        for field in FIELDS:
            cli_args += ['--field-id', field]
        run_cli(cli_args)
    manifest = json.loads((PRIVATE / 'records.manifest.json').read_text())
    if manifest.get('has_more') is not False or manifest.get('base_token') != BASE or manifest.get('table_id') != TABLE:
        raise RuntimeError('数据范围或分页未完成，保留上次发布数据。')
    rows = [json.loads(line) for line in records_file.read_text().splitlines() if line.strip()]
    if not rows or len(rows) != manifest.get('records_count') or len({r['record_id'] for r in rows}) != len(rows):
        raise RuntimeError('记录数或唯一性校验失败，保留上次发布数据。')
    seed_tokens, seed_files = {}, {}
    if args.seed_cache and args.seed_records:
        for line in args.seed_records.read_text().splitlines():
            row = json.loads(line)
            for field in ['封面', '对应视频', '参考图']:
                for file in row.get(field, []):
                    seed_tokens[file['file_token']] = file
        for file in args.seed_cache.rglob('*'):
            if file.is_file() and file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm']:
                seed_files.setdefault((file.name, file.stat().st_size), file)
    cache_path = PRIVATE / 'media-index.json'
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    media_dir = ROOT / 'public/media'
    media_dir.mkdir(parents=True, exist_ok=True)
    temp_dir = PRIVATE / 'downloads'
    temp_dir.mkdir(exist_ok=True)
    jobs = [(row['record_id'], field, file) for row in rows for field in ['封面', '对应视频', '参考图'] for file in row.get(field, [])]

    def attachment(job):
        record_id, field, info = job
        token, size = info['file_token'], info['size']
        old = cache.get(token)
        if old and (ROOT / 'public' / old['path']).is_file() and (ROOT / 'public' / old['path']).stat().st_size == size:
            return token, old
        file = None
        if seed_tokens.get(token) == info:
            file = seed_files.get((info['name'], size))
        if file is None:
            suffix = Path(info['name']).suffix.lower()
            file = temp_dir / (hashlib.sha256(token.encode()).hexdigest() + suffix)
            run_cli(['+record-download-attachment', '--base-token', BASE, '--table-id', TABLE, '--record-id', record_id, '--file-token', token, '--output', str(file.relative_to(ROOT)), '--overwrite'])
        if not file.is_file() or file.stat().st_size != size:
            raise RuntimeError('附件大小校验失败，保留上次发布数据。')
        digest = hashlib.sha256(file.read_bytes()).hexdigest()
        suffix = file.suffix.lower()
        if suffix not in ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm']:
            raise RuntimeError('附件格式暂不支持：' + suffix)
        target = media_dir / (digest[:20] + suffix)
        if not target.exists():
            shutil.copyfile(file, target)
        return token, {'path': 'media/' + target.name, 'sha256': digest, 'size': size, 'meta': probe(target)}

    with ThreadPoolExecutor(max_workers=4) as pool:
        for token, item in pool.map(attachment, jobs):
            cache[token] = item
    catalog = []
    for order, row in enumerate(rows):
        def media(field):
            return [cache[file['file_token']] for file in row.get(field, [])]
        covers, videos, references = media('封面'), media('对应视频'), media('参考图')
        if not covers or not videos:
            raise RuntimeError('收录记录缺少封面或视频，保留上次发布数据。')
        description, usage = public_description(row.get('复现笔记'))
        prompt = (row.get('提示词') or '').strip()
        metadata = videos[0].get('meta') or covers[0].get('meta') or {'width': 4, 'height': 3, 'duration': 0}
        catalog.append({
            'id': hashlib.sha256(row['record_id'].encode()).hexdigest()[:14],
            'order': order, 'title': row.get('作品名称') or '未命名作品',
            'kind': 'prompt' if prompt else 'reference', 'prompt': prompt,
            'negativePrompt': row.get('负面提示词') or '', 'description': description,
            'usage': usage, 'source': (row.get('来源') or ['未标注'])[0],
            'sourceUrl': web_url(row.get('原始链接')), 'author': row.get('作者') or '',
            'model': (row.get('模型') or ['待确认'])[0], 'modelVersion': row.get('模型版本') or '',
            'method': (row.get('生成方式') or ['待确认'])[0], 'tags': row.get('风格标签') or [],
            'status': (row.get('状态') or ['待整理'])[0], 'parameters': row.get('生成参数') or '',
            'createdAt': row.get('收录时间'), 'cover': covers[0]['path'], 'video': videos[0]['path'],
            'references': [file['path'] for file in references], **metadata,
        })
    payload = {'schemaVersion': 1, 'updatedAt': datetime.now(timezone.utc).isoformat(), 'count': len(catalog), 'items': catalog}
    out = ROOT / 'public/data/catalog.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    temp = out.with_suffix('.tmp')
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    temp.replace(out)
    cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + '\n')
    referenced = {name for item in catalog for name in [item['cover'], item['video'], *item['references']]}
    for file in media_dir.iterdir():
        if re.fullmatch(r'[a-f0-9]{20}\.(?:jpg|jpeg|png|webp|mp4|webm)', file.name) and 'media/' + file.name not in referenced:
            file.unlink()
    print(f"已同步 {len(catalog)} 条：{sum(bool(r['prompt']) for r in catalog)} 条提示词，{sum(not bool(r['prompt']) for r in catalog)} 条效果参考；{len(jobs)} 个附件。")

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
