import { create } from 'zustand';

/** Keep first-launch workspace navigation from dismissing an open global search. */
export const useCommandMenuVisibility = create<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>((set) => ({ open: false, setOpen: (open) => set({ open }) }));
