export class BinarySafetyGate {
  static check(command: string): boolean {
    const unsafePatterns = ['rm -rf', 'format C:'];
    return !unsafePatterns.some(p => command.includes(p));
  }
}
