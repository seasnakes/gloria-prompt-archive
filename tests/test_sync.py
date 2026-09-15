import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
spec = importlib.util.spec_from_file_location('sync', Path(__file__).parents[1] / 'scripts/sync_feishu_api.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)
class SyncTests(unittest.TestCase):
    def test_pagination_stops_and_rejects_repeated_cursor(self):
        with patch.object(sync, 'request', side_effect=[{'data': {'items': [1], 'has_more': True, 'page_token': 'p2'}}, {'data': {'items': [2], 'has_more': False}}]):
            self.assertEqual(sync.pages('test', 'secret'), [1, 2])
        with patch.object(sync, 'request', return_value={'data': {'items': [], 'has_more': True, 'page_token': 'same'}}):
            with self.assertRaises(RuntimeError): sync.pages('test', 'secret')
    def test_only_public_projection_and_complete_options(self):
        records = [{'record_id': 'private-record', 'fields': {'作品名称': 'Example', '提示词': 'Prompt', '封面': [{'file_token': 'private-token'}], '内部备注': 'private-note', '风格标签': ['风景']}}]
        result = sync.build_catalog(records, {'private-token': 'https://example.com/cover'}, [{'field_name': '风格标签', 'property': {'options': [{'name': '风景'}, {'name': '人物'}]}}])
        self.assertEqual(result['items'][0]['cover'], 'https://example.com/cover')
        self.assertEqual(result['options']['tags'], ['风景', '人物'])
        self.assertNotIn('private-', str(result))
        self.assertEqual(result['items'][0]['prompt'], 'Prompt')
        with self.assertRaises(RuntimeError): sync.build_catalog(records * 2, {}, [])
    def test_dimensions_and_source(self):
        self.assertEqual(sync.dimensions('目标 1920x1080；实测 720×1280'), (720, 1280, True))
        self.assertEqual(sync.dimensions(''), (4, 3, False))
        self.assertIsNone(sync.public_url('https://my.feishu.cn/base/private'))
        self.assertIsNone(sync.public_url('javascript:alert(1)'))
if __name__ == '__main__': unittest.main()
