// Shared by every service's list/findMany function so pagination math and
// search-filter construction aren't reimplemented per model.

function getPagination({ page, limit }) {
  return { skip: (page - 1) * limit, take: limit };
}

function buildPaginationMeta({ page, limit, total }) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

// MySQL's default collation is case-insensitive already, so a plain
// `contains` (no `mode: 'insensitive'` — that option isn't supported on the
// MySQL provider anyway) is enough for a "search box" style filter.
function searchFilter(search, fields) {
  if (!search) return {};
  return { OR: fields.map((field) => ({ [field]: { contains: search } })) };
}

export { getPagination, buildPaginationMeta, searchFilter };
