use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Hospital {
    pub authority: Pubkey,
    #[max_len(Hospital::NAME_MAX)]
    pub name: String,
    #[max_len(Hospital::LOCATION_MAX)]
    pub location: String,
    #[max_len(Hospital::REG_MAX)]
    pub registration_number: String,
    #[max_len(Hospital::PHONE_MAX)]
    pub phone: String,
    pub is_active: bool,
    pub created_at: i64,
    pub bump: u8,
    pub next_medicine_id: u64,
    pub next_payment_id: u64,
}

impl Hospital {
    pub const NAME_MAX: usize = 64;
    pub const LOCATION_MAX: usize = 128;
    pub const REG_MAX: usize = 32;
    pub const PHONE_MAX: usize = 24;
}

#[account]
#[derive(InitSpace)]
pub struct Treasury {
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Manager {
    pub hospital: Pubkey,
    pub wallet: Pubkey,
    pub is_active: bool,
    pub appointed_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum StaffRole {
    Doctor,
    Nurse,
    Other,
}

#[account]
#[derive(InitSpace)]
pub struct Staff {
    pub hospital: Pubkey,
    pub wallet: Pubkey,
    pub role: StaffRole,
    #[max_len(Staff::DEPARTMENT_MAX)]
    pub department: String,
    #[max_len(Staff::LICENSE_MAX)]
    pub license_number: String,
    pub is_active: bool,
    pub registered_at: i64,
    pub bump: u8,
}

impl Staff {
    pub const DEPARTMENT_MAX: usize = 64;
    pub const LICENSE_MAX: usize = 32;
}

#[account]
#[derive(InitSpace)]
pub struct Patient {
    pub hospital: Pubkey,
    pub wallet: Pubkey,
    #[max_len(Patient::NAME_MAX)]
    pub full_name: String,
    #[max_len(Patient::DOB_MAX)]
    pub date_of_birth: String,
    #[max_len(Patient::BLOOD_MAX)]
    pub blood_type: String,
    #[max_len(Patient::PHONE_MAX)]
    pub phone: String,
    #[max_len(Patient::EMERGENCY_MAX)]
    pub emergency_contact: String,
    pub registered_at: i64,
    pub next_record_id: u64,
    pub bump: u8,
}

impl Patient {
    pub const NAME_MAX: usize = 64;
    pub const DOB_MAX: usize = 16;
    pub const BLOOD_MAX: usize = 8;
    pub const PHONE_MAX: usize = 24;
    pub const EMERGENCY_MAX: usize = 64;
}

#[account]
#[derive(InitSpace)]
pub struct MedicalRecord {
    pub hospital: Pubkey,
    pub patient: Pubkey,
    pub author_staff: Pubkey,
    pub record_id: u64,
    #[max_len(MedicalRecord::DIAGNOSIS_MAX)]
    pub diagnosis: String,
    #[max_len(MedicalRecord::TREATMENT_MAX)]
    pub treatment: String,
    #[max_len(MedicalRecord::NOTES_MAX)]
    pub notes: String,
    pub visit_date: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl MedicalRecord {
    pub const DIAGNOSIS_MAX: usize = 256;
    pub const TREATMENT_MAX: usize = 256;
    pub const NOTES_MAX: usize = 512;
}

#[account]
#[derive(InitSpace)]
pub struct Medicine {
    pub hospital: Pubkey,
    pub medicine_id: u64,
    #[max_len(Medicine::NAME_MAX)]
    pub name: String,
    #[max_len(Medicine::SKU_MAX)]
    pub sku: String,
    pub stock_quantity: u32,
    pub unit_price_lamports: u64,
    pub requires_prescription: bool,
    pub bump: u8,
}

impl Medicine {
    pub const NAME_MAX: usize = 64;
    pub const SKU_MAX: usize = 32;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PaymentStatus {
    Pending,
    Completed,
    Refunded,
    Cancelled,
}

#[account]
#[derive(InitSpace)]
pub struct Payment {
    pub hospital: Pubkey,
    pub patient: Pubkey,
    pub medical_record: Option<Pubkey>,
    pub medicine: Option<Pubkey>,
    pub payment_id: u64,
    pub amount_lamports: u64,
    pub status: PaymentStatus,
    #[max_len(Payment::DESCRIPTION_MAX)]
    pub description: String,
    pub created_at: i64,
    pub bump: u8,
}

impl Payment {
    pub const DESCRIPTION_MAX: usize = 128;
}
