const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "docrd6tkk";
const UPLOAD_PRESET =
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "MicoLeao";

// Upload direto do navegador pro Cloudinary usando um upload preset
// "unsigned" (não precisa de API secret no frontend).
export async function enviarImagemParaCloudinary(arquivo) {
  const formData = new FormData();
  formData.append("file", arquivo);
  formData.append("upload_preset", UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    throw new Error("Falha ao enviar imagem para o Cloudinary");
  }

  const dados = await response.json();
  return dados.secure_url;
}
