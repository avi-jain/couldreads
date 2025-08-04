import { parse } from 'node-html-parser';

export default async function handler(req, res) {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }
  const url = `https://www.goodreads.com/review/list/${userId}?shelf=read`;
  try {
    const response = await fetch(url);
    const html = await response.text();
    const root = parse(html);
    const rows = root.querySelectorAll('table#books tbody tr.bookalike.review');
    const titles = [];
    rows.forEach(row => {
      const titleAnchor = row.querySelector('td.field.title .value a');
      if (titleAnchor) {
        titles.push(titleAnchor.text.trim());
      }
    });
    res.status(200).json({ titles });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Goodreads data' });
  }
}