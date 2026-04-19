use crate::access::{
    require_can_edit_medical_record, require_hospital_admin, require_staff_or_admin,
    validate_bounded, validate_bounded_non_empty, validate_payment_description,
};
use crate::contexts::*;
use crate::errors::ErrorCode;
use crate::state::{
    Hospital, MedicalRecord, Medicine, Patient, Payment, PaymentStatus, Staff, StaffRole,
};
use anchor_lang::prelude::*;

pub fn register_hospital(
    ctx: Context<RegisterHospital>,
    name: String,
    location: String,
    registration_number: String,
    phone: String,
) -> Result<()> {
    validate_bounded_non_empty(&name, Hospital::NAME_MAX)?;
    validate_bounded_non_empty(&location, Hospital::LOCATION_MAX)?;
    validate_bounded_non_empty(&registration_number, Hospital::REG_MAX)?;
    validate_bounded_non_empty(&phone, Hospital::PHONE_MAX)?;

    let hospital = &mut ctx.accounts.hospital;
    hospital.authority = ctx.accounts.authority.key();
    hospital.name = name;
    hospital.location = location;
    hospital.registration_number = registration_number;
    hospital.phone = phone;
    hospital.is_active = true;
    hospital.created_at = Clock::get()?.unix_timestamp;
    hospital.bump = ctx.bumps.hospital;
    hospital.next_medicine_id = 1;
    hospital.next_payment_id = 1;

    ctx.accounts.treasury.bump = ctx.bumps.treasury;
    Ok(())
}

pub fn register_manager(ctx: Context<RegisterManager>) -> Result<()> {
    let new_pk = ctx.accounts.new_manager.key();
    require!(new_pk != Pubkey::default(), ErrorCode::InvalidPubkey);
    require!(
        new_pk != ctx.accounts.hospital.authority,
        ErrorCode::AuthorityCannotBeManagerAccount
    );

    let manager = &mut ctx.accounts.manager;
    manager.hospital = ctx.accounts.hospital.key();
    manager.wallet = new_pk;
    manager.is_active = true;
    manager.appointed_at = Clock::get()?.unix_timestamp;
    manager.bump = ctx.bumps.manager;
    Ok(())
}

pub fn add_staff(
    ctx: Context<AddStaff>,
    role: StaffRole,
    department: String,
    license_number: String,
) -> Result<()> {
    validate_bounded_non_empty(&department, Staff::DEPARTMENT_MAX)?;
    validate_bounded_non_empty(&license_number, Staff::LICENSE_MAX)?;

    let staff_wallet = ctx.accounts.staff_wallet.key();
    require!(staff_wallet != Pubkey::default(), ErrorCode::InvalidPubkey);

    require_hospital_admin(
        &ctx.accounts.hospital,
        &ctx.accounts.admin,
        ctx.accounts.manager.as_ref(),
    )?;

    let staff = &mut ctx.accounts.staff;
    staff.hospital = ctx.accounts.hospital.key();
    staff.wallet = staff_wallet;
    staff.role = role;
    staff.department = department;
    staff.license_number = license_number;
    staff.is_active = true;
    staff.registered_at = Clock::get()?.unix_timestamp;
    staff.bump = ctx.bumps.staff;
    Ok(())
}

pub fn register_patient(
    ctx: Context<RegisterPatient>,
    full_name: String,
    date_of_birth: String,
    blood_type: String,
    phone: String,
    emergency_contact: String,
) -> Result<()> {
    validate_bounded_non_empty(&full_name, Patient::NAME_MAX)?;
    validate_bounded_non_empty(&date_of_birth, Patient::DOB_MAX)?;
    validate_bounded_non_empty(&blood_type, Patient::BLOOD_MAX)?;
    validate_bounded_non_empty(&phone, Patient::PHONE_MAX)?;
    validate_bounded_non_empty(&emergency_contact, Patient::EMERGENCY_MAX)?;

    let patient_wallet = ctx.accounts.patient_wallet.key();
    require!(patient_wallet != Pubkey::default(), ErrorCode::InvalidPubkey);

    require_hospital_admin(
        &ctx.accounts.hospital,
        &ctx.accounts.admin,
        ctx.accounts.manager.as_ref(),
    )?;

    let patient = &mut ctx.accounts.patient;
    patient.hospital = ctx.accounts.hospital.key();
    patient.wallet = patient_wallet;
    patient.full_name = full_name;
    patient.date_of_birth = date_of_birth;
    patient.blood_type = blood_type;
    patient.phone = phone;
    patient.emergency_contact = emergency_contact;
    patient.registered_at = Clock::get()?.unix_timestamp;
    patient.next_record_id = 1;
    patient.bump = ctx.bumps.patient;
    Ok(())
}

pub fn create_medical_record(
    ctx: Context<CreateMedicalRecord>,
    diagnosis: String,
    treatment: String,
    notes: String,
    visit_date: i64,
) -> Result<()> {
    require!(
        ctx.accounts.hospital.is_active,
        ErrorCode::HospitalInactive
    );
    require!(visit_date != 0, ErrorCode::InvalidVisitDate);
    validate_bounded_non_empty(&diagnosis, MedicalRecord::DIAGNOSIS_MAX)?;
    validate_bounded_non_empty(&treatment, MedicalRecord::TREATMENT_MAX)?;
    validate_bounded(&notes, MedicalRecord::NOTES_MAX)?;
    require!(ctx.accounts.staff.is_active, ErrorCode::StaffInactive);
    require_keys_eq!(
        ctx.accounts.staff.hospital,
        ctx.accounts.hospital.key(),
        ErrorCode::StaffWrongHospital
    );

    let now = Clock::get()?.unix_timestamp;
    let record_id = ctx.accounts.patient.next_record_id;
    let rec = &mut ctx.accounts.medical_record;
    rec.hospital = ctx.accounts.hospital.key();
    rec.patient = ctx.accounts.patient.key();
    rec.author_staff = ctx.accounts.staff.key();
    rec.record_id = record_id;
    rec.diagnosis = diagnosis;
    rec.treatment = treatment;
    rec.notes = notes;
    rec.visit_date = visit_date;
    rec.created_at = now;
    rec.updated_at = now;
    rec.bump = ctx.bumps.medical_record;

    ctx.accounts.patient.next_record_id = record_id
        .checked_add(1)
        .ok_or(error!(ErrorCode::IdOverflow))?;
    Ok(())
}

pub fn update_medical_record(
    ctx: Context<UpdateMedicalRecord>,
    diagnosis: String,
    treatment: String,
    notes: String,
    visit_date: i64,
) -> Result<()> {
    require!(
        ctx.accounts.hospital.is_active,
        ErrorCode::HospitalInactive
    );
    require!(visit_date != 0, ErrorCode::InvalidVisitDate);
    validate_bounded_non_empty(&diagnosis, MedicalRecord::DIAGNOSIS_MAX)?;
    validate_bounded_non_empty(&treatment, MedicalRecord::TREATMENT_MAX)?;
    validate_bounded(&notes, MedicalRecord::NOTES_MAX)?;

    require_can_edit_medical_record(
        &ctx.accounts.hospital,
        &ctx.accounts.signer,
        ctx.accounts.manager.as_ref(),
        ctx.accounts.staff_author.as_ref(),
        &ctx.accounts.medical_record,
    )?;

    let now = Clock::get()?.unix_timestamp;
    let rec = &mut ctx.accounts.medical_record;
    rec.diagnosis = diagnosis;
    rec.treatment = treatment;
    rec.notes = notes;
    rec.visit_date = visit_date;
    rec.updated_at = now;
    Ok(())
}

pub fn add_medicine(
    ctx: Context<AddMedicine>,
    name: String,
    sku: String,
    initial_stock: u32,
    unit_price_lamports: u64,
    requires_prescription: bool,
) -> Result<()> {
    validate_bounded_non_empty(&name, Medicine::NAME_MAX)?;
    validate_bounded_non_empty(&sku, Medicine::SKU_MAX)?;
    require_hospital_admin(
        &ctx.accounts.hospital,
        &ctx.accounts.admin,
        ctx.accounts.manager.as_ref(),
    )?;

    let id = ctx.accounts.hospital.next_medicine_id;
    let med = &mut ctx.accounts.medicine;
    med.hospital = ctx.accounts.hospital.key();
    med.medicine_id = id;
    med.name = name;
    med.sku = sku;
    med.stock_quantity = initial_stock;
    med.unit_price_lamports = unit_price_lamports;
    med.requires_prescription = requires_prescription;
    med.bump = ctx.bumps.medicine;

    ctx.accounts.hospital.next_medicine_id = id
        .checked_add(1)
        .ok_or(error!(ErrorCode::IdOverflow))?;
    Ok(())
}

pub fn create_payment(
    ctx: Context<CreatePayment>,
    amount_lamports: u64,
    description: String,
) -> Result<()> {
    require!(amount_lamports > 0, ErrorCode::PaymentAmountInvalid);
    validate_payment_description(&description, Payment::DESCRIPTION_MAX)?;

    require_staff_or_admin(
        &ctx.accounts.hospital,
        &ctx.accounts.signer,
        ctx.accounts.manager.as_ref(),
        ctx.accounts.staff.as_ref(),
    )?;

    let medical_record_pubkey = if let Some(mr) = ctx.accounts.medical_record.as_ref() {
        require_keys_eq!(
            mr.patient,
            ctx.accounts.patient.key(),
            ErrorCode::InvalidPatientRecord
        );
        require_keys_eq!(
            mr.hospital,
            ctx.accounts.hospital.key(),
            ErrorCode::InvalidHospital
        );
        Some(mr.key())
    } else {
        None
    };

    let medicine_pubkey = if let Some(m) = ctx.accounts.medicine.as_ref() {
        require_keys_eq!(
            m.hospital,
            ctx.accounts.hospital.key(),
            ErrorCode::MedicineHospitalMismatch
        );
        Some(m.key())
    } else {
        None
    };

    let id = ctx.accounts.hospital.next_payment_id;
    let pay = &mut ctx.accounts.payment;
    pay.hospital = ctx.accounts.hospital.key();
    pay.patient = ctx.accounts.patient.key();
    pay.medical_record = medical_record_pubkey;
    pay.medicine = medicine_pubkey;
    pay.payment_id = id;
    pay.amount_lamports = amount_lamports;
    pay.status = PaymentStatus::Pending;
    pay.description = description;
    pay.created_at = Clock::get()?.unix_timestamp;
    pay.bump = ctx.bumps.payment;

    ctx.accounts.hospital.next_payment_id = id
        .checked_add(1)
        .ok_or(error!(ErrorCode::IdOverflow))?;
    Ok(())
}

pub fn set_manager_active(ctx: Context<SetManagerActive>, is_active: bool) -> Result<()> {
    ctx.accounts.manager.is_active = is_active;
    Ok(())
}

pub fn set_staff_active(ctx: Context<SetStaffActive>, is_active: bool) -> Result<()> {
    require_hospital_admin(
        &ctx.accounts.hospital,
        &ctx.accounts.admin,
        ctx.accounts.manager.as_ref(),
    )?;
    ctx.accounts.staff.is_active = is_active;
    Ok(())
}

pub fn update_medicine_stock(ctx: Context<UpdateMedicineStock>, new_stock: u32) -> Result<()> {
    require_hospital_admin(
        &ctx.accounts.hospital,
        &ctx.accounts.admin,
        ctx.accounts.manager.as_ref(),
    )?;
    ctx.accounts.medicine.stock_quantity = new_stock;
    Ok(())
}

pub fn adjust_medicine_stock(ctx: Context<AdjustMedicineStock>, delta: i32) -> Result<()> {
    require_staff_or_admin(
        &ctx.accounts.hospital,
        &ctx.accounts.signer,
        ctx.accounts.manager.as_ref(),
        ctx.accounts.staff.as_ref(),
    )?;
    let med = &mut ctx.accounts.medicine;
    let current = med.stock_quantity as i64;
    let next = current
        .checked_add(delta as i64)
        .ok_or(error!(ErrorCode::StockArithmeticOverflow))?;
    require!(next >= 0, ErrorCode::InsufficientStock);
    med.stock_quantity = next as u32;
    Ok(())
}

pub fn complete_payment(ctx: Context<CompletePayment>) -> Result<()> {
    let payment = &ctx.accounts.payment;
    match payment.status {
        PaymentStatus::Pending => {}
        PaymentStatus::Completed => return err!(ErrorCode::PaymentAlreadyCompleted),
        PaymentStatus::Refunded | PaymentStatus::Cancelled => {
            return err!(ErrorCode::PaymentNotCompletable);
        }
    }
    require_keys_eq!(
        payment.patient,
        ctx.accounts.patient.key(),
        ErrorCode::InvalidPatient
    );
    require_keys_eq!(
        ctx.accounts.patient_signer.key(),
        ctx.accounts.patient.wallet,
        ErrorCode::InvalidPatientSigner
    );

    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.patient_signer.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        payment.amount_lamports,
    )
    .map_err(|_| error!(ErrorCode::SystemTransferFailed))?;

    ctx.accounts.payment.status = PaymentStatus::Completed;
    Ok(())
}

pub fn set_payment_status(ctx: Context<SetPaymentStatus>, status: PaymentStatus) -> Result<()> {
    require_hospital_admin(
        &ctx.accounts.hospital,
        &ctx.accounts.admin,
        ctx.accounts.manager.as_ref(),
    )?;
    ctx.accounts.payment.status = status;
    Ok(())
}

pub fn set_hospital_active(ctx: Context<SetHospitalActive>, is_active: bool) -> Result<()> {
    ctx.accounts.hospital.is_active = is_active;
    Ok(())
}
