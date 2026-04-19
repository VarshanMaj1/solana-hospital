use crate::errors::ErrorCode;
use crate::state::{
    Hospital, Manager, MedicalRecord, Medicine, Patient, Payment, Staff, Treasury,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RegisterHospital<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Hospital::INIT_SPACE,
        seeds = [b"hospital", authority.key().as_ref()],
        bump
    )]
    pub hospital: Account<'info, Hospital>,
    #[account(
        init,
        payer = authority,
        space = 8 + Treasury::INIT_SPACE,
        seeds = [b"treasury", hospital.key().as_ref()],
        bump
    )]
    pub treasury: Account<'info, Treasury>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterManager<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"hospital", authority.key().as_ref()],
        bump = hospital.bump,
        constraint = hospital.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub hospital: Account<'info, Hospital>,
    /// CHECK: wallet that receives manager permissions
    pub new_manager: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Manager::INIT_SPACE,
        seeds = [b"manager", hospital.key().as_ref(), new_manager.key().as_ref()],
        bump
    )]
    pub manager: Account<'info, Manager>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetManagerActive<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [b"hospital", authority.key().as_ref()],
        bump = hospital.bump,
        constraint = hospital.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub hospital: Account<'info, Hospital>,
    #[account(
        mut,
        seeds = [b"manager", hospital.key().as_ref(), manager.wallet.as_ref()],
        bump = manager.bump,
        constraint = manager.hospital == hospital.key() @ ErrorCode::InvalidHospital
    )]
    pub manager: Account<'info, Manager>,
}

#[derive(Accounts)]
pub struct AddStaff<'info> {
    #[account(
        mut,
        seeds = [b"hospital", hospital.authority.as_ref()],
        bump = hospital.bump
    )]
    pub hospital: Account<'info, Hospital>,
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(optional)]
    pub manager: Option<Account<'info, Manager>>,
    /// CHECK: staff member's wallet (identity)
    pub staff_wallet: UncheckedAccount<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Staff::INIT_SPACE,
        seeds = [b"staff", hospital.key().as_ref(), staff_wallet.key().as_ref()],
        bump
    )]
    pub staff: Account<'info, Staff>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetStaffActive<'info> {
    #[account(
        seeds = [b"hospital", hospital.authority.as_ref()],
        bump = hospital.bump
    )]
    pub hospital: Account<'info, Hospital>,
    pub admin: Signer<'info>,
    #[account(optional)]
    pub manager: Option<Account<'info, Manager>>,
    #[account(
        mut,
        seeds = [b"staff", hospital.key().as_ref(), staff.wallet.as_ref()],
        bump = staff.bump,
        constraint = staff.hospital == hospital.key() @ ErrorCode::InvalidHospital
    )]
    pub staff: Account<'info, Staff>,
}

#[derive(Accounts)]
pub struct RegisterPatient<'info> {
    #[account(
        seeds = [b"hospital", hospital.authority.as_ref()],
        bump = hospital.bump
    )]
    pub hospital: Account<'info, Hospital>,
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(optional)]
    pub manager: Option<Account<'info, Manager>>,
    /// CHECK: patient's wallet
    pub patient_wallet: UncheckedAccount<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Patient::INIT_SPACE,
        seeds = [b"patient", hospital.key().as_ref(), patient_wallet.key().as_ref()],
        bump
    )]
    pub patient: Account<'info, Patient>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateMedicalRecord<'info> {
    #[account(
        seeds = [b"hospital", hospital.authority.as_ref()],
        bump = hospital.bump
    )]
    pub hospital: Account<'info, Hospital>,
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        seeds = [b"staff", hospital.key().as_ref(), signer.key().as_ref()],
        bump = staff.bump,
        constraint = staff.wallet == signer.key() @ ErrorCode::Unauthorized,
        constraint = staff.hospital == hospital.key() @ ErrorCode::StaffWrongHospital
    )]
    pub staff: Account<'info, Staff>,
    #[account(
        mut,
        seeds = [b"patient", hospital.key().as_ref(), patient.wallet.as_ref()],
        bump = patient.bump,
        constraint = patient.hospital == hospital.key() @ ErrorCode::PatientWrongHospital
    )]
    pub patient: Account<'info, Patient>,
    #[account(
        init,
        payer = signer,
        space = 8 + MedicalRecord::INIT_SPACE,
        seeds = [
            b"record",
            patient.key().as_ref(),
            patient.next_record_id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub medical_record: Account<'info, MedicalRecord>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMedicalRecord<'info> {
    #[account(
        seeds = [b"hospital", hospital.authority.as_ref()],
        bump = hospital.bump
    )]
    pub hospital: Account<'info, Hospital>,
    pub signer: Signer<'info>,
    #[account(optional)]
    pub manager: Option<Account<'info, Manager>>,
    #[account(optional)]
    pub staff_author: Option<Account<'info, Staff>>,
    #[account(
        seeds = [b"patient", hospital.key().as_ref(), patient.wallet.as_ref()],
        bump = patient.bump,
        constraint = patient.hospital == hospital.key() @ ErrorCode::PatientWrongHospital
    )]
    pub patient: Account<'info, Patient>,
    #[account(
        mut,
        seeds = [
            b"record",
            patient.key().as_ref(),
            medical_record.record_id.to_le_bytes().as_ref()
        ],
        bump = medical_record.bump,
        constraint = medical_record.hospital == hospital.key() @ ErrorCode::InvalidHospital,
        constraint = medical_record.patient == patient.key() @ ErrorCode::InvalidPatientRecord
    )]
    pub medical_record: Account<'info, MedicalRecord>,
}

#[derive(Accounts)]
pub struct AddMedicine<'info> {
    #[account(
        mut,
        seeds = [b"hospital", hospital.authority.as_ref()],
        bump = hospital.bump
    )]
    pub hospital: Account<'info, Hospital>,
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(optional)]
    pub manager: Option<Account<'info, Manager>>,
    #[account(
        init,
        payer = admin,
        space = 8 + Medicine::INIT_SPACE,
        seeds = [
            b"medicine",
            hospital.key().as_ref(),
            hospital.next_medicine_id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub medicine: Account<'info, Medicine>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMedicineStock<'info> {
    #[account(
        seeds = [b"hospital", hospital.authority.as_ref()],
        bump = hospital.bump
    )]
    pub hospital: Account<'info, Hospital>,
    pub admin: Signer<'info>,
    #[account(optional)]
    pub manager: Option<Account<'info, Manager>>,
    #[account(
        mut,
        seeds = [
            b"medicine",
            hospital.key().as_ref(),
            medicine.medicine_id.to_le_bytes().as_ref()
        ],
        bump = medicine.bump,
        constraint = medicine.hospital == hospital.key() @ ErrorCode::MedicineHospitalMismatch
    )]
    pub medicine: Account<'info, Medicine>,
}

#[derive(Accounts)]
pub struct AdjustMedicineStock<'info> {
    #[account(
        seeds = [b"hospital", hospital.authority.as_ref()],
        bump = hospital.bump
    )]
    pub hospital: Account<'info, Hospital>,
    pub signer: Signer<'info>,
    #[account(optional)]
    pub manager: Option<Account<'info, Manager>>,
    #[account(optional)]
    pub staff: Option<Account<'info, Staff>>,
    #[account(
        mut,
        seeds = [
            b"medicine",
            hospital.key().as_ref(),
            medicine.medicine_id.to_le_bytes().as_ref()
        ],
        bump = medicine.bump,
        constraint = medicine.hospital == hospital.key() @ ErrorCode::MedicineHospitalMismatch
    )]
    pub medicine: Account<'info, Medicine>,
}

#[derive(Accounts)]
#[instruction(amount_lamports: u64, description: String)]
pub struct CreatePayment<'info> {
    #[account(
        mut,
        seeds = [b"hospital", hospital.authority.as_ref()],
        bump = hospital.bump
    )]
    pub hospital: Account<'info, Hospital>,
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(optional)]
    pub manager: Option<Account<'info, Manager>>,
    #[account(optional)]
    pub staff: Option<Account<'info, Staff>>,
    #[account(
        seeds = [b"patient", hospital.key().as_ref(), patient.wallet.as_ref()],
        bump = patient.bump,
        constraint = patient.hospital == hospital.key() @ ErrorCode::PatientWrongHospital
    )]
    pub patient: Account<'info, Patient>,
    #[account(optional)]
    pub medical_record: Option<Account<'info, MedicalRecord>>,
    #[account(optional)]
    pub medicine: Option<Account<'info, Medicine>>,
    #[account(
        init,
        payer = signer,
        space = 8 + Payment::INIT_SPACE,
        seeds = [
            b"payment",
            hospital.key().as_ref(),
            hospital.next_payment_id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub payment: Account<'info, Payment>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CompletePayment<'info> {
    #[account(
        seeds = [b"hospital", hospital.authority.as_ref()],
        bump = hospital.bump
    )]
    pub hospital: Account<'info, Hospital>,
    #[account(
        mut,
        seeds = [b"treasury", hospital.key().as_ref()],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,
    #[account(
        seeds = [b"patient", hospital.key().as_ref(), patient.wallet.as_ref()],
        bump = patient.bump,
        constraint = patient.hospital == hospital.key() @ ErrorCode::PatientWrongHospital
    )]
    pub patient: Account<'info, Patient>,
    #[account(mut)]
    pub patient_signer: Signer<'info>,
    #[account(
        mut,
        seeds = [
            b"payment",
            hospital.key().as_ref(),
            payment.payment_id.to_le_bytes().as_ref()
        ],
        bump = payment.bump,
        constraint = payment.hospital == hospital.key() @ ErrorCode::InvalidHospital,
        constraint = payment.patient == patient.key() @ ErrorCode::InvalidPatient
    )]
    pub payment: Account<'info, Payment>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPaymentStatus<'info> {
    #[account(
        seeds = [b"hospital", hospital.authority.as_ref()],
        bump = hospital.bump
    )]
    pub hospital: Account<'info, Hospital>,
    pub admin: Signer<'info>,
    #[account(optional)]
    pub manager: Option<Account<'info, Manager>>,
    #[account(
        mut,
        seeds = [
            b"payment",
            hospital.key().as_ref(),
            payment.payment_id.to_le_bytes().as_ref()
        ],
        bump = payment.bump,
        constraint = payment.hospital == hospital.key() @ ErrorCode::InvalidHospital
    )]
    pub payment: Account<'info, Payment>,
}

#[derive(Accounts)]
pub struct SetHospitalActive<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"hospital", authority.key().as_ref()],
        bump = hospital.bump,
        constraint = hospital.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub hospital: Account<'info, Hospital>,
}
