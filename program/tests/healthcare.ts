import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";

describe("healthcare", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.healthcare as Program<anchor.Idl>;

  it("loads with expected program id", () => {
    expect(program.programId.toBase58()).to.equal(
      "6FyZincSKRMEJkiFxB3bHkP1rJJnEMoGf3FUCqs8tKgK"
    );
  });
});
