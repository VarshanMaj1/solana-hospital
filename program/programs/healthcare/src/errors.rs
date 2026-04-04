use anchor_lang::prelude::*;

/// Domain-specific errors for the healthcare program.
/// Anchor assigns sequential custom program error codes starting at 6000.
#[error_code]
pub enum ErrorCode {
    // --- Core / authorization ---
    #[msg("The signer is not authorized for this action")]
    Unauthorized,
    #[msg("Signer does not match the required role or account owner")]
    InvalidSigner,

    // --- Hospital ---
    #[msg("Hospital is inactive; operations are blocked until reactivated")]
    HospitalInactive,
    #[msg("Hospital account does not match expected linkage or PDA")]
    InvalidHospital,

    // --- Manager ---
    #[msg("Manager PDA must be included when the signer is not the hospital authority")]
    ManagerAccountRequired,
    #[msg("Manager account does not match the canonical PDA for (hospital, signer)")]
    InvalidManagerPda,
    #[msg("Manager is inactive")]
    ManagerInactive,
    #[msg("Manager is registered for a different hospital")]
    ManagerWrongHospital,
    #[msg("The hospital authority cannot hold a separate manager PDA; use authority-only flows")]
    AuthorityCannotBeManagerAccount,

    // --- Staff ---
    #[msg("Staff PDA must be included when the signer is not admin")]
    StaffAccountRequired,
    #[msg("Staff account does not match the canonical PDA for (hospital, signer)")]
    InvalidStaffPda,
    #[msg("Staff is inactive")]
    StaffInactive,
    #[msg("Staff is assigned to a different hospital")]
    StaffWrongHospital,

    // --- Patient ---
    #[msg("Patient account does not match the payment or record linkage")]
    InvalidPatient,
    #[msg("Signing wallet must match the patient account wallet")]
    InvalidPatientSigner,
    #[msg("Medical record patient field does not match the provided patient account")]
    InvalidPatientRecord,
    #[msg("Patient is not registered under this hospital")]
    PatientWrongHospital,

    // --- Medical records ---
    #[msg("Signer must be the record author (staff), an active manager, or hospital authority")]
    NotRecordAuthorOrAdmin,
    #[msg("Visit timestamp is invalid")]
    InvalidVisitDate,

    // --- Medicine / inventory ---
    #[msg("Medicine belongs to a different hospital than the operation context")]
    MedicineHospitalMismatch,
    #[msg("Arithmetic overflow while adjusting stock")]
    StockArithmeticOverflow,
    #[msg("Stock cannot be negative after this adjustment")]
    InsufficientStock,

    // --- Payments ---
    #[msg("Payment amount must be greater than zero")]
    PaymentAmountInvalid,
    #[msg("Payment is already completed")]
    PaymentAlreadyCompleted,
    #[msg("Payment cannot be completed in its current status")]
    PaymentNotCompletable,
    #[msg("Payment description cannot be empty")]
    PaymentDescriptionInvalid,

    // --- System / CPI ---
    #[msg("SOL transfer to treasury failed")]
    SystemTransferFailed,

    // --- Input validation ---
    #[msg("Required string field is empty")]
    EmptyString,
    #[msg("String exceeds maximum allowed length")]
    StringTooLong,
    #[msg("Public key is default or invalid")]
    InvalidPubkey,

    // --- Numeric ---
    #[msg("Internal ID counter overflow")]
    IdOverflow,
    #[msg("Numeric overflow in calculation")]
    NumericOverflow,

    // --- Generic account state ---
    #[msg("The target account is inactive")]
    AccountInactive,

    // --- Reserved / extended domains (use when adding features) ---
    #[msg("String is shorter than minimum required length")]
    StringTooShort,
    #[msg("Treasury PDA does not match this hospital")]
    InvalidTreasury,
    #[msg("Medicine account is invalid for this hospital")]
    InvalidMedicineAccount,
    #[msg("Hospital authority signature is required for this action")]
    HospitalAuthorityRequired,
    #[msg("This action requires the hospital authority or an active manager")]
    ForbiddenRequiresAdmin,
    #[msg("This action requires hospital authority, manager, or active staff")]
    ForbiddenRequiresStaffOrAdmin,
    #[msg("Payment must be in Pending status to complete settlement")]
    PaymentMustBePending,
}
