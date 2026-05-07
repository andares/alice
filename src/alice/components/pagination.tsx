/** 分页导航组件 (HTMX 增强) */

interface PaginationProps {
  current: number;
  total: number;  // max 50
  baseUrl: string;
}

/**
 * 渲染分页按钮组
 * 使用 DaisyUI join + btn 样式，支持 HTMX 无刷新加载
 */
function getVisiblePages(current: number, total: number): number[] {
  const maxVisible = 7;
  const half = Math.floor(maxVisible / 2);
  let start = Math.max(1, current - half);
  let end = Math.min(total, start + maxVisible - 1);

  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  const pages: number[] = [];
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
}

export function Pagination(props: PaginationProps): JSX.Element {
  const { current, total, baseUrl } = props;

  const cappedTotal = Math.min(total, 50);
  const pages = getVisiblePages(current, cappedTotal);
  const prevDisabled = current === 1 || cappedTotal === 0 ? 'btn-disabled' : '';
  const nextDisabled = current === cappedTotal || cappedTotal === 0 ? 'btn-disabled' : '';

  return (
    <div class="join">
      <a
        class={`join-item btn ${prevDisabled}`}
        href={`${baseUrl}?page=${current - 1}`}
      >
        «
      </a>
      {pages.map((page) => {
        const activeClass = page === current ? 'btn-active' : '';
        return (
          <a
            class={`join-item btn ${activeClass}`}
            href={`${baseUrl}?page=${page}`}
          >
            {page}
          </a>
        );
      })}
      <a
        class={`join-item btn ${nextDisabled}`}
        href={`${baseUrl}?page=${current + 1}`}
      >
        »
      </a>
    </div>
  );
}
