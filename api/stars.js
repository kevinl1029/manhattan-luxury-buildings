import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`select building_name from starred_buildings order by starred_at`;
      res.status(200).json({ starred: rows.map((r) => r.building_name) });
      return;
    }

    if (req.method === 'POST') {
      const { building } = req.body ?? {};
      if (!building) {
        res.status(400).json({ error: 'building is required' });
        return;
      }
      await sql`insert into starred_buildings (building_name) values (${building}) on conflict do nothing`;
      res.status(204).end();
      return;
    }

    if (req.method === 'DELETE') {
      const building = req.query.building;
      if (!building) {
        res.status(400).json({ error: 'building is required' });
        return;
      }
      await sql`delete from starred_buildings where building_name = ${building}`;
      res.status(204).end();
      return;
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    res.status(405).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
}
