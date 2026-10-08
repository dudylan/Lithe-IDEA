import { describe, expect, test } from "bun:test";
import {
  matchMavenLocationParts,
  matchStackLocationParts,
  resolveOutputLocation,
} from "./run-output-locations";

const ROOT = "D:/work/server";
const CONTEXT = {
  workspaceRoot: ROOT,
  sourceRoots: [
    "D:/work/server/web_service/src/main/java",
    "D:/work/server/web_service/src/test/java",
  ],
};

describe("run output location scanning", () => {
  test("matches Maven diagnostics with line and column", () => {
    expect(
      matchMavenLocationParts("[ERROR] web_service/src/Foo.java:[42,5] broken"),
    ).toEqual({ relativePath: "web_service/src/Foo.java", line: 42, column: 5 });
    expect(matchMavenLocationParts("[ERROR] no location here")).toBeNull();
  });

  test("matches Java stack frames including inner classes", () => {
    expect(matchStackLocationParts("\tat com.cgn.Foo$Bar.run(Foo.java:42)")).toEqual({
      className: "com.cgn.Foo$Bar",
      fileName: "Foo.java",
      line: 42,
    });
    expect(matchStackLocationParts("no frame")).toBeNull();
  });

  test("stack frames resolve the outer class under the first project source root", () => {
    const hit = resolveOutputLocation(
      "16:33:18.902 \tat com.cgn.Foo$Bar.run(Foo.java:42)",
      CONTEXT,
    );
    expect(hit?.target.path).toBe(
      "D:/work/server/web_service/src/main/java/com/cgn/Foo.java",
    );
    expect(hit?.target.line).toBe(42);
    // The clickable fragment covers the whole frame, not the leading clock+tab.
    expect(hit?.start).toBe("16:33:18.902 \t".length);
  });

  test("workspaces without a project model fall back to the conventional layout", () => {
    const hit = resolveOutputLocation("\tat com.example.Order.process(Order.java:7)", {
      workspaceRoot: "D:/work/plain",
      sourceRoots: [],
    });
    expect(hit?.target.path).toBe("D:/work/plain/src/main/java/com/example/Order.java");
  });

  test("Maven diagnostics resolve against the workspace root", () => {
    const hit = resolveOutputLocation(
      "[ERROR] web_service/src/main/java/com/cgn/Foo.java:[10,3] cannot find symbol",
      CONTEXT,
    );
    expect(hit?.target.path).toBe(`${ROOT}/web_service/src/main/java/com/cgn/Foo.java`);
    expect(hit?.target.line).toBe(10);
    expect(hit?.target.column).toBe(3);
  });

  test("plain lines stay plain text", () => {
    expect(resolveOutputLocation("16:33:18.902 INFO nothing clickable", CONTEXT)).toBeNull();
  });
});
