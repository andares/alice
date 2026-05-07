/** 全屏模态框组件 */

interface ModalProps {
  id: string;
  title: string;
  children: JSX.Element;
}

/**
 * 渲染 DaisyUI 模态框
 * 使用原生 <dialog> 元素，支持 HTMX 动态填充内容
 */
export function Modal(props: ModalProps): JSX.Element {
  const { id, title, children } = props;

  return (
    <dialog id={id} class="modal">
      <div class="modal-box w-[90vw] h-[90vh] flex flex-col p-6">
        <div class="flex justify-between items-center mb-4 shrink-0">
          <h3 class="font-bold text-lg">{title}</h3>
          <form method="dialog">
            <button class="btn btn-sm btn-circle btn-ghost">✕</button>
          </form>
        </div>
        <div id="modal-content" class="overflow-auto flex-1">
          {children}
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}
