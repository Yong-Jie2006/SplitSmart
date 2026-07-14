import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;
const DialogClose = DialogPrimitive.Close;

function DialogContent({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Popup>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/50" />
      <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPrimitive.Popup
          className={cn(
            "w-full max-w-md rounded-xl border bg-card p-6 shadow-xl outline-none",
            className,
          )}
          {...props}
        />
      </DialogPrimitive.Viewport>
    </DialogPrimitive.Portal>
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
};
