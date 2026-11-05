function getPagination({ page, limit }) {
  return { skip: (page - 1) * limit, take: limit };
}

function buildPaginationMeta({ page, limit, total }) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
function searchFilter(search, fields) {
  if (!search) return {};
  return { OR: fields.map((field) => ({ [field]: { contains: search } })) };
}

export { getPagination, buildPaginationMeta, searchFilter };
