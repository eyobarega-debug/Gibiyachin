import { useCallback, useRef, useState } from "react";

/**
 * Controlled form state helper.
 * Keeps field values in one object and provides an `onChange` handler that
 * works for text inputs, selects, checkboxes and file inputs.
 */
export function useForm(initialValues = {}) {
  const [values, setValues] = useState(initialValues);

  const set = useCallback((name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleChange = useCallback((e) => {
    const target = e?.target ?? e;
    const { name, type, value, checked, files } = target;
    setValues((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "file" ? files : value,
    }));
  }, []);

  const reset = useCallback((next = initialValues) => setValues(next), [initialValues]);

  return { values, setValues, set, handleChange, reset };
}

/**
 * Wraps an async submit function with loading / error / success state and a
 * hard guard against duplicate submissions (double-click / double-tap).
 *
 * @param {Function} submitFn  async function invoked with the arguments of `run`
 * @param {{ onSuccess?: Function, onError?: Function }} options
 */
export function useFormSubmit(submitFn, options = {}) {
  const { onSuccess, onError } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const busyRef = useRef(false);

  const run = useCallback(
    async (...args) => {
      if (busyRef.current) return undefined;
      busyRef.current = true;
      setLoading(true);
      setError("");
      setSuccess("");
      try {
        const result = await submitFn(...args);
        if (result && result.message) setSuccess(result.message);
        onSuccess?.(result);
        return result;
      } catch (err) {
        const message =
          err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Something went wrong. Please try again.";
        setError(message);
        onError?.(err);
        return undefined;
      } finally {
        busyRef.current = false;
        setLoading(false);
      }
    },
    [submitFn, onSuccess, onError],
  );

  const clearMessages = useCallback(() => {
    setError("");
    setSuccess("");
  }, []);

  return { run, loading, error, setError, success, setSuccess, clearMessages };
}
