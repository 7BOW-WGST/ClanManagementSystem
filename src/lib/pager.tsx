import type { FC } from 'hono/jsx'

// Previous/next pager for list pages (hidden when there is a single page).
export const Pager: FC<{ page: number; totalPages: number; basePath: string }> = (props) => {
  if (props.totalPages <= 1) {
    return null
  }
  return (
    <nav class="mt-3">
      <ul class="pagination">
        <li class={`page-item ${props.page <= 1 ? 'disabled' : ''}`}>
          <a class="page-link" href={`${props.basePath}?page=${props.page - 1}`}>
            Previous
          </a>
        </li>
        <li class="page-item disabled">
          <span class="page-link">
            Page {props.page} of {props.totalPages}
          </span>
        </li>
        <li class={`page-item ${props.page >= props.totalPages ? 'disabled' : ''}`}>
          <a class="page-link" href={`${props.basePath}?page=${props.page + 1}`}>
            Next
          </a>
        </li>
      </ul>
    </nav>
  )
}
