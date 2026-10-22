export async function api(path) {
  const res = await fetch(path);
  const json = await res.json().catch(() => ({ status: false, message: 'Respons server tidak valid' }));
  if (!json.status) throw new Error(json.message || 'Gagal memuat data');
  return json.data;
}
