export function shouldHandoffToHuman(text: string): boolean {
  const t = (text || "").toLowerCase();
  const triggers = [
    "humano",
    "asesor",
    "vendedor",
    "persona",
    "quiero hablar",
    "atencion",
    "transferencia",
    "tarjeta",
    "pago",
    "envio",
    "dirección",
    "direccion",
  ];
  return triggers.some(k => t.includes(k));
}
