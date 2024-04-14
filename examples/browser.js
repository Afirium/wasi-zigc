import { initZigWASI, runZigCompiler, runZigOutput } from "../dist/index.js";

const zigCode = String.raw`
    const std = @import("std");

    pub fn main() !void {
        std.debug.print("Hello, World!\n", .{});
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

	await runZigCompiler(await zigCompiler.arrayBuffer(), wasi);
    await runZigOutput(Buffer.from(wasi.fds[3].dir.contents.get("input.wasm").data));
})();
