import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export const exportToPDF = async (element, filename, backgroundColor = "#0d0d0d") => {
  if (!element) return;
  const canvas = await html2canvas(element, {
    backgroundColor,
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const data = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");
  const imgWidth = 190;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 10;

  pdf.addImage(data, "PNG", 10, position, imgWidth, imgHeight);
  heightLeft -= 277;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight + 10;
    pdf.addPage();
    pdf.addImage(data, "PNG", 10, position, imgWidth, imgHeight);
    heightLeft -= 277;
  }

  pdf.save(filename);
};