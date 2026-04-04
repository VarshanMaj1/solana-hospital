use crate::errors::ErrorCode;
use crate::state::{Hospital, Manager, MedicalRecord, Staff};
use anchor_lang::prelude::*;

pub fn validate_bounded_non_empty(value: &str, max_len: usize) -> Result<()> {
    require!(!value.is_empty(), ErrorCode::EmptyString);
    require!(value.len() <= max_len, ErrorCode::StringTooLong);
    Ok(())
}

pub fn validate_bounded(value: &str, max_len: usize) -> Result<()> {
    require!(value.len() <= max_len, ErrorCode::StringTooLong);
    Ok(())
}

pub fn validate_payment_description(description: &str, max_len: usize) -> Result<()> {
    require!(!description.is_empty(), ErrorCode::PaymentDescriptionInvalid);
    require!(description.len() <= max_len, ErrorCode::StringTooLong);
    Ok(())
}

pub fn require_can_edit_medical_record<'info>(
    hospital: &Hospital,
    signer: &Signer<'info>,
    manager: Option<&Account<'info, Manager>>,
    staff_author: Option<&Account<'info, Staff>>,
    record: &MedicalRecord,
) -> Result<()> {
    if hospital.authority == signer.key() {
        return Ok(());
    }
    if let Some(m) = manager {
        if m.is_active && m.hospital == hospital.key() && m.wallet == signer.key() {
            let (expected, _) = Pubkey::find_program_address(
                &[
                    b"manager",
                    hospital.key().as_ref(),
                    signer.key().as_ref(),
                ],
                &crate::ID,
            );
            if m.key() == expected {
                return Ok(());
            }
        }
    }
    let s = staff_author.ok_or(error!(ErrorCode::NotRecordAuthorOrAdmin))?;
    require!(s.is_active, ErrorCode::StaffInactive);
    require_keys_eq!(
        s.key(),
        record.author_staff,
        ErrorCode::NotRecordAuthorOrAdmin
    );
    require_keys_eq!(s.hospital, hospital.key(), ErrorCode::StaffWrongHospital);
    require_keys_eq!(s.wallet, signer.key(), ErrorCode::InvalidSigner);
    let (expected, _) = Pubkey::find_program_address(
        &[
            b"staff",
            hospital.key().as_ref(),
            signer.key().as_ref(),
        ],
        &crate::ID,
    );
    require_keys_eq!(s.key(), expected, ErrorCode::InvalidStaffPda);
    Ok(())
}

pub fn require_hospital_admin<'info>(
    hospital: &Hospital,
    admin: &Signer<'info>,
    manager: Option<&Account<'info, Manager>>,
) -> Result<()> {
    require!(hospital.is_active, ErrorCode::HospitalInactive);
    if hospital.authority == admin.key() {
        return Ok(());
    }
    let m = manager.ok_or(error!(ErrorCode::ManagerAccountRequired))?;
    require!(m.is_active, ErrorCode::ManagerInactive);
    require_keys_eq!(m.hospital, hospital.key(), ErrorCode::ManagerWrongHospital);
    require_keys_eq!(m.wallet, admin.key(), ErrorCode::InvalidSigner);
    let (expected, _) = Pubkey::find_program_address(
        &[
            b"manager",
            hospital.key().as_ref(),
            admin.key().as_ref(),
        ],
        &crate::ID,
    );
    require_keys_eq!(m.key(), expected, ErrorCode::InvalidManagerPda);
    Ok(())
}

pub fn require_staff_or_admin<'info>(
    hospital: &Hospital,
    signer: &Signer<'info>,
    manager: Option<&Account<'info, Manager>>,
    staff: Option<&Account<'info, Staff>>,
) -> Result<()> {
    require!(hospital.is_active, ErrorCode::HospitalInactive);
    if hospital.authority == signer.key() {
        return Ok(());
    }
    if let Some(m) = manager {
        if m.is_active && m.hospital == hospital.key() && m.wallet == signer.key() {
            let (expected, _) = Pubkey::find_program_address(
                &[
                    b"manager",
                    hospital.key().as_ref(),
                    signer.key().as_ref(),
                ],
                &crate::ID,
            );
            if m.key() == expected {
                return Ok(());
            }
        }
    }
    let s = staff.ok_or(error!(ErrorCode::StaffAccountRequired))?;
    require!(s.is_active, ErrorCode::StaffInactive);
    require_keys_eq!(s.hospital, hospital.key(), ErrorCode::StaffWrongHospital);
    require_keys_eq!(s.wallet, signer.key(), ErrorCode::InvalidSigner);
    let (expected, _) = Pubkey::find_program_address(
        &[
            b"staff",
            hospital.key().as_ref(),
            signer.key().as_ref(),
        ],
        &crate::ID,
    );
    require_keys_eq!(s.key(), expected, ErrorCode::InvalidStaffPda);
    Ok(())
}
