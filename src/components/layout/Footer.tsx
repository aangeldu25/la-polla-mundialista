// Footer mínimo y no invasivo. En móvil queda por encima del tab bar
// (que es fixed), por eso el padding-bottom extra en pantallas pequeñas.
export function Footer() {
  return (
    <footer className="mt-auto py-4 pb-24 md:pb-4 text-center">
      <p className="text-[11px] text-gray-400 font-medium">
        Creado por <span className="font-semibold text-gray-500">aangeldu</span>{" "}
        para los amantes del fútbol ⚽
      </p>
    </footer>
  );
}
