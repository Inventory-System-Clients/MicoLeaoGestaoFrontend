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

// PDF (contratos, documentos de projeto): vai como "raw" no Cloudinary, que
// guarda o arquivo como veio. Limite de 10 MB por arquivo.
// Para o link abrir, a conta precisa permitir entrega de PDF (Cloudinary >
// Settings > Security > "Allow delivery of PDF and ZIP files").
export const LIMITE_PDF_MB = 10;

export async function enviarPdfParaCloudinary(arquivo) {
  const ehPdf =
    arquivo?.type === "application/pdf" || /\.pdf$/i.test(arquivo?.name || "");
  if (!ehPdf) throw new Error("Escolha um arquivo PDF.");
  if (arquivo.size > LIMITE_PDF_MB * 1024 * 1024) {
    throw new Error(`O PDF passa de ${LIMITE_PDF_MB} MB.`);
  }

  const formData = new FormData();
  formData.append("file", arquivo);
  formData.append("upload_preset", UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`,
    { method: "POST", body: formData },
  );
  if (!response.ok) throw new Error("Falha ao enviar o PDF.");
  const dados = await response.json();
  // raw nem sempre mantém a extensão no link; garante o .pdf
  return /\.pdf$/i.test(dados.secure_url) ? dados.secure_url : `${dados.secure_url}.pdf`;
}
