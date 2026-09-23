# 作业画廊

目前 5 个学生的画板和页面已建立，但没有公开任何作业文件。

收到家长许可和 PDF 后，把 PDF 放在 `pdf/`，把其第一页导出的 JPG 或 PNG 放在 `covers/`，再在 `manifest.json` 中相应学生的 `assignments` 列表添加一项，例如：

```json
{
  "title": "第 1 次作业",
  "date": "2026-09-23",
  "pages": 3,
  "pdf": "pdf/ziqing-2026-09-23.pdf",
  "cover": "covers/ziqing-2026-09-23.jpg"
}
```

画板显示该学生列表中最后一项的封面；学生页面显示全部 PDF。请只放允许公开的作业，上传前检查姓名以外的个人信息、批注和照片。
