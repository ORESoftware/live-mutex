

export const forDebugging = {
   previousTime : Date.now()
};



export enum RWStatus {
  EndWrite = 'end_write',
  BeginWrite = 'begin_write',
  EndRead = 'end_read',
  BeginRead = 'begin_read',
  LockingWriteKey = 'locking_write_key',
  UnlockingWriteKey = 'unlocking_write_key'
}
