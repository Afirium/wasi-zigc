import { initZigWASI, runZigCompiler, runZigOutput } from "../dist/index.js";

const zigCode = String.raw`
    const std = @import("std");

    pub fn main() !void {
        std.debug.print("Hello, World!\n", .{});
    }
`;

const zigCodeModified = String.raw`
	const std = @import("std");

	pub fn main() !void {
		std.debug.print("你好，世界!\n", .{});
	}
`;

(async () => {
    const bytes = await fetch(
        "https://github.com/Afirium/zigc-wasm/releases/download/v0.11.0/std.zip",
    ).then((r) => r.blob());
    const buf = await bytes.arrayBuffer();
    const std = new Uint8Array(buf);

    const wasi = await initZigWASI(std, zigCode);
    const zigCompiler = await fetch(
        "https://github.com/Afirium/zigc-wasm/releases/download/v0.11.0/zig_small.wasm",
    );

    const zigCompilerArray = await zigCompiler.arrayBuffer();

    // Hello world #1
    await runZigCompiler(zigCompilerArray, wasi);
    await runZigOutput(Buffer.from(wasi.fds[3].dir.contents.get("input.wasm").data));

    // Hello world #2
    wasi.fds[3].dir.contents.get("input.zig").data = new TextEncoder().encode(zigCodeModified);

    await runZigCompiler(zigCompilerArray, wasi);
    await runZigOutput(Buffer.from(wasi.fds[3].dir.contents.get("input.wasm").data));
})();
