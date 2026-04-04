//! Healthcare management program for Solana (Anchor).
//!
//! ## Layout
//! - `errors` — `ErrorCode` enum for clients and on-chain checks.
//! - `state` — Account structs (`Hospital`, `Patient`, …).
//! - `contexts` — `#[derive(Accounts)]` validation per instruction.
//! - `access` — Authorization and input validation helpers.
//! - `instructions` — Instruction implementations called from `healthcare::*`.

pub mod access;
pub mod contexts;
pub mod errors;
pub mod instructions;
pub mod state;

pub use contexts::*;
pub use errors::ErrorCode;
pub use state::*;

use anchor_lang::prelude::*;

declare_id!("6FyZincSKRMEJkiFxB3bHkP1rJJnEMoGf3FUCqs8tKgK");

#[program]
pub mod healthcare {
    use super::*;

    pub fn register_hospital(
        ctx: Context<RegisterHospital>,
        name: String,
        location: String,
        registration_number: String,
        phone: String,
    ) -> Result<()> {
        instructions::register_hospital(ctx, name, location, registration_number, phone)
    }

    pub fn register_manager(ctx: Context<RegisterManager>) -> Result<()> {
        instructions::register_manager(ctx)
    }

    pub fn add_staff(
        ctx: Context<AddStaff>,
        role: StaffRole,
        department: String,
        license_number: String,
    ) -> Result<()> {
        instructions::add_staff(ctx, role, department, license_number)
    }

    pub fn register_patient(
        ctx: Context<RegisterPatient>,
        full_name: String,
        date_of_birth: String,
        blood_type: String,
        phone: String,
        emergency_contact: String,
    ) -> Result<()> {
        instructions::register_patient(
            ctx,
            full_name,
            date_of_birth,
            blood_type,
            phone,
            emergency_contact,
        )
    }

    pub fn create_medical_record(
        ctx: Context<CreateMedicalRecord>,
        diagnosis: String,
        treatment: String,
        notes: String,
        visit_date: i64,
    ) -> Result<()> {
        instructions::create_medical_record(ctx, diagnosis, treatment, notes, visit_date)
    }

    pub fn update_medical_record(
        ctx: Context<UpdateMedicalRecord>,
        diagnosis: String,
        treatment: String,
        notes: String,
        visit_date: i64,
    ) -> Result<()> {
        instructions::update_medical_record(ctx, diagnosis, treatment, notes, visit_date)
    }

    pub fn add_medicine(
        ctx: Context<AddMedicine>,
        name: String,
        sku: String,
        initial_stock: u32,
        unit_price_lamports: u64,
        requires_prescription: bool,
    ) -> Result<()> {
        instructions::add_medicine(
            ctx,
            name,
            sku,
            initial_stock,
            unit_price_lamports,
            requires_prescription,
        )
    }

    pub fn create_payment(
        ctx: Context<CreatePayment>,
        amount_lamports: u64,
        description: String,
    ) -> Result<()> {
        instructions::create_payment(ctx, amount_lamports, description)
    }

    pub fn set_manager_active(ctx: Context<SetManagerActive>, is_active: bool) -> Result<()> {
        instructions::set_manager_active(ctx, is_active)
    }

    pub fn set_staff_active(ctx: Context<SetStaffActive>, is_active: bool) -> Result<()> {
        instructions::set_staff_active(ctx, is_active)
    }

    pub fn update_medicine_stock(ctx: Context<UpdateMedicineStock>, new_stock: u32) -> Result<()> {
        instructions::update_medicine_stock(ctx, new_stock)
    }

    pub fn adjust_medicine_stock(ctx: Context<AdjustMedicineStock>, delta: i32) -> Result<()> {
        instructions::adjust_medicine_stock(ctx, delta)
    }

    pub fn complete_payment(ctx: Context<CompletePayment>) -> Result<()> {
        instructions::complete_payment(ctx)
    }

    pub fn set_payment_status(ctx: Context<SetPaymentStatus>, status: PaymentStatus) -> Result<()> {
        instructions::set_payment_status(ctx, status)
    }

    pub fn set_hospital_active(ctx: Context<SetHospitalActive>, is_active: bool) -> Result<()> {
        instructions::set_hospital_active(ctx, is_active)
    }
}
