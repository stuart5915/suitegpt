// C:\Users\info\Documents\stuart-hollinger-landing\stuart-hollinger-landing\agents\foodvitals-agent\work\barcode-fallback\barcode_scanner_module.test.cjs

const { scanBarcodeWithFallback } = require('./barcode_scanner_module.cjs');

console.log('Running barcode fallback tests...');

async function runTests() {
    let testCount = 0;
    let failCount = 0;

    const assert = (condition, message) => {
        testCount++;
        if (!condition) {
            console.error(`FAIL: ${message}`);
            failCount++;
        } else {
            console.log(`PASS: ${message}`);
        }
    };

    // Mock functions for testing
    const mockOcrSuccess = async (imageBuffer, attempt) => {
        return { success: true, barcode: "098765432109", productInfo: { name: "OCR Product", brand: "OCR Brand" }, error: null };
    };

    const mockOcrLowConfidenceWithBarcode = async (imageBuffer, attempt) => {
        if (attempt === 1) return { success: false, barcode: null, productInfo: null, error: "OCR_LOW_CONFIDENCE" };
        return { success: false, barcode: "123456789012", productInfo: null, error: "OCR_FAILED_TO_EXTRACT" };
    };

    const mockOcrFailedNoBarcode = async (imageBuffer, attempt) => {
        return { success: false, barcode: null, productInfo: null, error: "OCR_NO_BARCODE_FOUND" };
    };

    const mockOcrFailedWithKnownBarcode = async (imageBuffer, attempt) => {
        return { success: false, barcode: "123456789012", productInfo: null, error: "OCR_FAILED_TO_EXTRACT" };
    };

    const mockOcrFailedWithUnknownBarcode = async (imageBuffer, attempt) => {
        return { success: false, barcode: "unknown_barcode", productInfo: null, error: "OCR_FAILED_TO_EXTRACT" };
    };

    const mockUpcSuccess = async (barcodeNumber) => {
        if (barcodeNumber === "123456789012") {
            return {
                success: true,
                productInfo: { name: "Milk (UPCitemdb)", brand: "Dairy Co.", description: "Fresh whole milk" },
                error: null
            };
        }
        return { success: false, productInfo: null, error: "UNEXPECTED_BARCODE_FOR_MOCK" };
    };

    const mockUpcProductNotFound = async (barcodeNumber) => {
        return { success: false, productInfo: null, error: "PRODUCT_NOT_FOUND_UPCITEMDB" };
    };

    const mockUpcApiError = async (barcodeNumber) => {
        return { success: false, productInfo: null, error: "UPCITEMDB_API_ERROR" };
    };


    // Test Case 1: OCR success on first attempt
    console.log('\n--- Test Case 1: OCR success on first attempt ---');
    {
        const result = await scanBarcodeWithFallback("someImageBuffer", mockOcrSuccess, mockUpcApiError);
        assert(result.success === true, 'TC1: Should succeed');
        assert(result.productInfo.name === 'OCR Product', 'TC1: Should return OCR product info');
        assert(result.finalSource === 'OCR', 'TC1: Should indicate OCR as source');
        assert(result.error === null, 'TC1: Should have no error');
    }

    // Test Case 2: OCR fails twice, then UPCitemdb succeeds
    console.log('\n--- Test Case 2: OCR fails twice, UPCitemdb succeeds ---');
    {
        const ocrMock = async (imageBuffer, attempt) => {
            // Simulate low confidence on first, then failed but with barcode on second
            if (attempt === 1) return { success: false, barcode: null, productInfo: null, error: "OCR_LOW_CONFIDENCE" };
            return { success: false, barcode: "123456789012", productInfo: null, error: "OCR_FAILED_TO_EXTRACT" };
        };
        const result = await scanBarcodeWithFallback("someImageBuffer", ocrMock, mockUpcSuccess);
        assert(result.success === true, 'TC2: Should succeed via fallback');
        assert(result.productInfo.name === 'Milk (UPCitemdb)', 'TC2: Should return UPCitemdb product info');
        assert(result.finalSource === 'UPCITEMDB', 'TC2: Should indicate UPCITEMDB as source');
        assert(result.error === null, 'TC2: Should have no error');
    }

    // Test Case 3: OCR fails twice, UPCitemdb also fails (product not found)
    console.log('\n--- Test Case 3: OCR fails twice, UPCitemdb fails (product not found) ---');
    {
        const ocrMock = async (imageBuffer, attempt) => {
            if (attempt === 1) return { success: false, barcode: null, productInfo: null, error: "OCR_LOW_CONFIDENCE" };
            return { success: false, barcode: "999999999999", productInfo: null, error: "OCR_FAILED_TO_EXTRACT" };
        };
        const result = await scanBarcodeWithFallback("someImageBuffer", ocrMock, mockUpcProductNotFound);
        assert(result.success === false, 'TC3: Should fail completely');
        assert(result.productInfo === null, 'TC3: Should have no product info');
        assert(result.finalSource === 'UPCITEMDB_FAILED', 'TC3: Should indicate UPCITEMDB_FAILED as source');
        assert(result.error === 'PRODUCT_NOT_FOUND_UPCITEMDB', 'TC3: Should return UPCitemdb product not found error');
    }

    // Test Case 4: OCR fails twice, UPCitemdb fails (API error)
    console.log('\n--- Test Case 4: OCR fails twice, UPCitemdb fails (API error) ---');
    {
        const ocrMock = async (imageBuffer, attempt) => {
            if (attempt === 1) return { success: false, barcode: null, productInfo: null, error: "OCR_LOW_CONFIDENCE" };
            return { success: false, barcode: "unknown_barcode", productInfo: null, error: "OCR_FAILED_TO_EXTRACT" };
        };
        const result = await scanBarcodeWithFallback("someImageBuffer", ocrMock, mockUpcApiError);
        assert(result.success === false, 'TC4: Should fail completely due to API error');
        assert(result.productInfo === null, 'TC4: Should have no product info');
        assert(result.finalSource === 'UPCITEMDB_FAILED', 'TC4: Should indicate UPCITEMDB_FAILED as source');
        assert(result.error === 'UPCITEMDB_API_ERROR', 'TC4: Should return UPCitemdb API error');
    }

    // Test Case 5: OCR fails completely (no barcode extracted), no UPC lookup attempted
    console.log('\n--- Test Case 5: OCR fails completely (no barcode), no UPC lookup ---');
    {
        const ocrMock = async (imageBuffer, attempt) => {
            return { success: false, barcode: null, productInfo: null, error: "OCR_NO_BARCODE_FOUND" };
        };
        const result = await scanBarcodeWithFallback("someImageBuffer", ocrMock, mockUpcSuccess);
        assert(result.success === false, 'TC5: Should fail completely');
        assert(result.productInfo === null, 'TC5: Should have no product info');
        assert(result.finalSource === null, 'TC5: Should have no final source');
        assert(result.error === 'OCR_NO_BARCODE_FOUND', 'TC5: Should return OCR no barcode error');
    }

    console.log(`\nAll tests completed. Total: ${testCount}, Failed: ${failCount}`);
    return failCount === 0;
}

runTests();
