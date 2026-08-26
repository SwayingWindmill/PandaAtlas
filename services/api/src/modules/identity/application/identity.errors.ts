export class AccountProvisioningBlockedError extends Error {
  public constructor(public readonly state: string) {
    super(`Account provisioning is blocked while account state is ${state}`);
  }
}
