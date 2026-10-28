import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, description, children, footer, size = 'md' }) => {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="modal-title" className={`animate-fade-in w-full ${sizes[size]} max-h-[90vh] overflow-hidden rounded-lg bg-white shadow-xl outline-none`}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="modal-title" className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close dialog">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children && <div className="scroll-thin max-h-[65vh] overflow-y-auto px-5 py-4">{children}</div>}
        {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
};

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  busy?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ open, title, message, confirmLabel = 'Confirm', tone = 'primary', onConfirm, onCancel, busy }) => (
  <Modal
    open={open}
    onClose={onCancel}
    title={title}
    size="sm"
    footer={
      <>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant={tone} onClick={onConfirm} isLoading={busy}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="text-sm text-slate-700">{message}</div>
  </Modal>
);
