// Formato es-VE (tuteo venezolano). Nunca formatos hardcodeados — siempre Intl.*.
const qtyFmt = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 });
const dateFmt = new Intl.DateTimeFormat("es-VE", {
  dateStyle: "short",
  timeStyle: "short",
});

export const fmtQty = (n: number) => qtyFmt.format(n);
export const fmtDateTime = (iso: string) => dateFmt.format(new Date(iso));
