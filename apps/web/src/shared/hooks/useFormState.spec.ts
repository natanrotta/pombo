import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { act } from "react";
import { useFormState } from "./useFormState";

type Person = {
  name: string;
  age: number;
};

describe("useFormState", () => {
  it("starts with the initial values, no errors, and isDirty=false", () => {
    const { result } = renderHook(() => useFormState<Person>({ name: "Ana", age: 30 }));

    expect(result.current.formData).toEqual({ name: "Ana", age: 30 });
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
    expect(result.current.isDirty).toBe(false);
    expect(result.current.hasErrors).toBe(false);
  });

  it("setField updates the field, marks it touched and flips isDirty", () => {
    const { result } = renderHook(() => useFormState<Person>({ name: "Ana", age: 30 }));

    act(() => result.current.setField("name", "Beatriz"));

    expect(result.current.formData.name).toBe("Beatriz");
    expect(result.current.touched.name).toBe(true);
    expect(result.current.isDirty).toBe(true);
  });

  it("validates on setField via the schema and clears the error when valid", () => {
    const { result } = renderHook(() =>
      useFormState<Person>({ name: "", age: 30 }, { name: (v) => (v.trim() ? null : "Required") })
    );

    act(() => result.current.setField("name", ""));
    expect(result.current.errors.name).toBe("Required");

    act(() => result.current.setField("name", "Ana"));
    expect(result.current.errors.name).toBeUndefined();
  });

  it("keeps setField's identity across edits", () => {
    const schema = { name: (v: string) => (v ? null : "Required") };
    const { result } = renderHook(() => useFormState<Person>({ name: "", age: 30 }, schema));
    const first = result.current.setField;

    act(() => result.current.setField("name", "Ana"));
    act(() => result.current.setField("age", 31));

    expect(result.current.setField).toBe(first);
  });

  it("validates a field against the values set just before it in the same tick", () => {
    const schema = {
      age: (v: number, data: Person) => (data.name === "Kid" && v > 12 ? "Too old" : null),
    };
    const { result } = renderHook(() => useFormState<Person>({ name: "Ana", age: 30 }, schema));

    act(() => {
      result.current.setField("name", "Kid");
      result.current.setField("age", 40);
    });

    expect(result.current.formData).toEqual({ name: "Kid", age: 40 });
    expect(result.current.errors.age).toBe("Too old");
  });

  it("validates against the reset values after reset()", () => {
    const schema = {
      age: (v: number, data: Person) => (data.name === "Kid" && v > 12 ? "Too old" : null),
    };
    const { result } = renderHook(() => useFormState<Person>({ name: "Kid", age: 10 }, schema));

    act(() => result.current.reset({ name: "Ana", age: 30 }));
    act(() => result.current.setField("age", 40));

    expect(result.current.errors.age).toBeUndefined();
  });

  it("validate() returns false and populates errors for missing fields", () => {
    const { result } = renderHook(() =>
      useFormState<Person>(
        { name: "", age: 0 },
        {
          name: (v) => (v ? null : "Name required"),
          age: (v) => (v > 0 ? null : "Age required"),
        }
      )
    );

    let valid = true;
    act(() => {
      valid = result.current.validate();
    });

    expect(valid).toBe(false);
    expect(result.current.errors).toEqual({ name: "Name required", age: "Age required" });
    expect(result.current.hasErrors).toBe(true);
  });

  it("validate() returns true when the schema has no errors", () => {
    const { result } = renderHook(() =>
      useFormState<Person>({ name: "Ana", age: 30 }, { name: (v) => (v ? null : "Required") })
    );

    let valid = false;
    act(() => {
      valid = result.current.validate();
    });

    expect(valid).toBe(true);
    expect(result.current.errors).toEqual({});
  });

  it("setError sets a manual error and clearError removes it", () => {
    const { result } = renderHook(() => useFormState<Person>({ name: "Ana", age: 30 }));

    act(() => result.current.setError("name", "Server-side conflict"));
    expect(result.current.errors.name).toBe("Server-side conflict");

    act(() => result.current.clearError("name"));
    expect(result.current.errors.name).toBeUndefined();
  });

  it("reset() restores the initial values and clears state", () => {
    const { result } = renderHook(() => useFormState<Person>({ name: "Ana", age: 30 }));

    act(() => result.current.setField("name", "Beatriz"));
    act(() => result.current.setError("name", "fail"));
    act(() => result.current.reset());

    expect(result.current.formData).toEqual({ name: "Ana", age: 30 });
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
    expect(result.current.isDirty).toBe(false);
  });

  it("reset(newValues) updates the baseline so isDirty re-anchors", () => {
    const { result } = renderHook(() => useFormState<Person>({ name: "Ana", age: 30 }));

    act(() => result.current.reset({ name: "Carlos", age: 25 }));
    expect(result.current.formData).toEqual({ name: "Carlos", age: 25 });
    expect(result.current.isDirty).toBe(false);

    act(() => result.current.setField("name", "Carlos"));
    expect(result.current.isDirty).toBe(false); // same as new baseline
  });
});
