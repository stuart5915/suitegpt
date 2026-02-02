# Barcode Fallback Implementation Plan

## Objective
Implement a UPC database fallback mechanism for FoodVitals' barcode scanning feature to improve reliability and reduce scan failure rates.

## Selected API
UPCitemdb.com (free plan: 100 requests/day, no sign-up required for initial testing)
- Lookup function: `lookup` - provides item details for a given UPC, EAN, GTIN or ISBN.
- Endpoint: `https://api.upcitemdb.com/prod/trial/lookup?upc={barcode_number}` (for free plan)

## Integration Points in FoodVitals (Conceptual)
Since I cannot directly modify the FoodVitals app, this plan assumes the following conceptual integration:

1.  **`ScanService` (or similar component):** This service currently handles OCR-based barcode scanning.
2.  **`NutritionDataService`:** This service would fetch nutrition data using either OCR results or UPCitemdb results.

## Fallback Logic Workflow

1.  **User Scans Barcode:** The FoodVitals app attempts to scan a food product.
2.  **OCR Attempt:** The `ScanService` first attempts to extract the barcode number and product information using OCR (as it currently does).
3.  **OCR Failure Check:**
    *   **If OCR is successful:** Proceed with existing logic to retrieve nutrition data.
    *   **If OCR fails (or confidence is low) after 2 attempts:**
        *   Extract the raw barcode number (if available from the scan).
        *   Initiate a fallback to the `UPCitemdb.com` API.
4.  **UPCitemdb Lookup:**
    *   Construct a request to `https://api.upcitemdb.com/prod/trial/lookup?upc={barcode_number}` using the extracted barcode number.
    *   Handle API response:
        *   **Success:** Parse the JSON response to extract product name, brand, and potentially basic nutrition facts.
        *   **Failure/No Results:** If the UPC is not found or the API request fails, signal a complete scan failure to the user.
5.  **Nutrition Data Retrieval:**
    *   If UPCitemdb lookup is successful, use the retrieved product information to query the FoodVitals' internal nutrition database or a more comprehensive external nutrition API (if available and within budget/scope).
    *   Present the results to the user.

## Error Handling & Edge Cases

-   **Damaged Barcodes:** If OCR fails to extract a valid barcode number, the UPCitemdb lookup will not be possible. The system should report a complete scan failure.
-   **Store Brands/Missing Products:** UPCitemdb's database may not contain all products, especially obscure store brands. In such cases, the fallback should report "product not found" and potentially suggest manual entry.
-   **Rate Limiting:** The free plan for UPCitemdb has a limit of 100 requests/day. For production, a paid plan or a more robust API with higher limits would be required. The implementation should include basic rate-limiting awareness (e.g., if multiple failures occur within a short period, temporarily disable the fallback or alert the user).
-   **API Key Management:** For production, the API key for UPCitemdb (if a paid plan is used) would need to be securely stored and accessed (e.g., environment variables, secure secret management service). For the free trial, no API key is explicitly required.

## Next Steps (within agent)

1.  Create a placeholder file for the `barcode_scanner.js` or `barcode_scanner.ts` module that would contain the core fallback logic.
2.  Implement a mock function for OCR scanning that can simulate success and failure.
3.  Implement a function to call the UPCitemdb API.
4.  Write basic unit tests for the fallback logic.
5.  Document API key requirements in `integrations.json` (if a paid UPCitemdb plan is eventually needed).
