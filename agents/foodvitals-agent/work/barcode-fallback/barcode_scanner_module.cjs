// C:\Users\info\Documents\stuart-hollinger-landing\stuart-hollinger-landing\agents\foodvitals-agent\work\barcode-fallback\barcode_scanner_module.cjs

const internal = {
    /**
     * Simulates an OCR scan attempt.
     * @param {string} imageBuffer - A simulated image buffer or path.
     * @param {number} attempt - Current OCR attempt number.
     * @returns {Promise<{success: boolean, barcode: string | null, productInfo: object | null, error: string | null}>}
     */
    mockOcrScan: async (imageBuffer, attempt) => {
        // console.log(`Simulating internal OCR scan attempt ${attempt}...`);
        if (attempt === 1) {
            return { success: false, barcode: null, productInfo: null, error: "OCR_LOW_CONFIDENCE" };
        } else if (attempt === 2) {
            return { success: false, barcode: "123456789012", productInfo: null, error: "OCR_FAILED_TO_EXTRACT" };
        } else {
            return { success: true, barcode: "098765432109", productInfo: { name: "Sample Product (OCR)", brand: "OCR Brand" }, error: null };
        }
    },

    /**
     * Performs a UPC lookup using UPCitemdb API.
     * @param {string} barcodeNumber - The 12-digit UPC/EAN/GTIN/ISBN.
     * @returns {Promise<{success: boolean, productInfo: object | null, error: string | null}>}
     */
    lookupUpcitemdb: async (barcodeNumber) => {
        // console.log(`Attempting internal UPCitemdb lookup for barcode: ${barcodeNumber}...`);
        if (barcodeNumber === "123456789012") {
            return {
                success: true,
                productInfo: {
                    name: "Milk (UPCitemdb)",
                    brand: "Dairy Co.",
                    description: "Fresh whole milk",
                    nutrients: { calories: 150, fat: 8, protein: 8, carbs: 12 }
                },
                error: null
            };
        } else if (barcodeNumber === "999999999999") {
            return { success: false, productInfo: null, error: "PRODUCT_NOT_FOUND_UPCITEMDB" };
        } else {
            return { success: false, productInfo: null, error: "UPCITEMDB_API_ERROR" };
        }
    },

    /**
     * Main function to handle barcode scanning with OCR and UPC database fallback.
     * @param {string} imageBuffer - A simulated image buffer or path from the scan.
     * @param {Function} [ocrScanOverride] - The OCR scanning function to use (for injection/mocking).
     * @param {Function} [upcLookupOverride] - The UPC lookup function to use (for injection/mocking).
     * @returns {Promise<{success: boolean, productInfo: object | null, finalSource: string | null, error: string | null}>}
     */
    scanBarcodeWithFallback: async (imageBuffer, ocrScanOverride, upcLookupOverride) => {
        const ocrScanner = ocrScanOverride || internal.mockOcrScan;
        const upcLookup = upcLookupOverride || internal.lookupUpcitemdb;

        let ocrResult = await ocrScanner(imageBuffer, 1);

        if (ocrResult.success) {
            return { success: true, productInfo: ocrResult.productInfo, finalSource: "OCR", error: null };
        }

        // If OCR failed, try a second OCR attempt or immediately fallback based on error type.
        // Only try a second OCR attempt if the first one indicated low confidence and a barcode was NOT extracted.
        if (ocrResult.error === "OCR_LOW_CONFIDENCE" && !ocrResult.barcode) {
            ocrResult = await ocrScanner(imageBuffer, 2);
            if (ocrResult.success) {
                return { success: true, productInfo: ocrResult.productInfo, finalSource: "OCR_RETRY", error: null };
            }
        }

        // If OCR still failed and we have a potential barcode number, try UPCitemdb fallback
        if (!ocrResult.success && ocrResult.barcode) {
            const upcResult = await upcLookup(ocrResult.barcode);
            if (upcResult.success) {
                return { success: true, productInfo: upcResult.productInfo, finalSource: "UPCITEMDB", error: null };
            } else {
                return { success: false, productInfo: null, finalSource: "UPCITEMDB_FAILED", error: upcResult.error };
            }
        }

        // If no barcode was extracted by OCR or UPC lookup failed completely
        return { success: false, productInfo: null, finalSource: null, error: ocrResult.error || "UNKNOWN_SCAN_FAILURE" };
    }
};

module.exports = internal;
