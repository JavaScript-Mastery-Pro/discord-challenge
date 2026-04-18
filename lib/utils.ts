export function formatZodError(error: any) {
  const messages: string[] = [];

  if (error.formErrors?.length) {
    messages.push(...error.formErrors);
  }

  if (error.fieldErrors) {
    for (const key in error.fieldErrors) {
      const errs = error.fieldErrors[key];
      if (errs) {
        messages.push(...errs.map((e: string) => `${key}: ${e}`));
      }
    }
  }

  return messages;
}
