import Swal from "sweetalert2";

const baseConfig = {
  confirmButtonColor: "#ef3b24",
  cancelButtonColor: "#6b7280",
  customClass: {
    popup: "rounded-lg",
    confirmButton: "font-bold",
    cancelButton: "font-bold",
  },
};

export const confirmar = async ({
  title = "Confirmar ação?",
  text,
  html,
  confirmButtonText = "Confirmar",
  cancelButtonText = "Cancelar",
  icon = "warning",
} = {}) => {
  const resultado = await Swal.fire({
    ...baseConfig,
    title,
    text,
    html,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true,
    focusCancel: true,
  });

  return resultado.isConfirmed;
};

export const aviso = (title, text) =>
  Swal.fire({ ...baseConfig, title, text, icon: "warning" });

export const erro = (title, text) =>
  Swal.fire({ ...baseConfig, title, text, icon: "error" });

export const sucesso = (title, text) =>
  Swal.fire({ ...baseConfig, title, text, icon: "success" });

