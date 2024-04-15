import {
    WASI,
    File,
    OpenFile,
    ConsoleStdout,
    PreopenDirectory,
    Directory,
    type Fd,
} from "@bjorn3/browser_wasi_shim";
import { type ZipItem, iter } from "but-unzip";

async function buildDirectoryTree(files: Generator<ZipItem, void, void>): Promise<Directory> {
    const root = new Directory([]);

    for (const { filename, read } of files) {
        const parts = filename.split("/");
        let currentDirectory = root;

        parts.forEach(async (part, index) => {
            if (part !== "") {
                if (index === parts.length - 1) {
                    if (!currentDirectory.contents.has(part)) {
                        currentDirectory.contents.set(part, new File(await read()));
                    }
                } else {
                    if (!currentDirectory.contents.has(parts[index])) {
                        currentDirectory.contents.set(parts[index], new Directory([]));
                    }
                    currentDirectory = currentDirectory.contents.get(parts[index]) as Directory;
                }
            }
        });
    }

    return root.contents.get("std") as Directory;
}

export async function unZipStdLib(source: Uint8Array): Promise<Directory> {
    return await buildDirectoryTree(iter(source));
}

export async function initZigWASI(std: Uint8Array, zigCode: string, debug = false): Promise<WASI> {
    const args: string[] = [
        "zig_small.wasm",
        "build-exe",
        "input.zig",
        "-Dtarget=wasm64-wasi",
        "-fno-llvm",
        "-fno-lld",
        "-O",
        "ReleaseSmall",
    ];
    const env: string[] = [];
    const fds: Fd[] = [
        new OpenFile(new File([])), // stdin
        new OpenFile(new File([])), // stdout
        ConsoleStdout.lineBuffered((msg) => console.log(`[WASI stderr] ${msg}`)), // stderr
        new PreopenDirectory(
            ".",
            new Map([["input.zig", new File(new TextEncoder().encode(zigCode))]]),
        ),
        new PreopenDirectory("/lib", new Map([["std", await unZipStdLib(std)]])),
        new PreopenDirectory("/cache", new Map()),
    ];

    return new WASI(args, env, fds, { debug });
}

export async function runZigCompiler(zigc: BufferSource, wasi: WASI): Promise<WASI> {
    const wasm = await WebAssembly.compile(zigc);
    const instance = await WebAssembly.instantiate(wasm, {
        wasi_snapshot_preview1: wasi.wasiImport,
    });

    try {
        // @ts-ignore
        wasi.start(instance);
    } catch (err) {
        console.log("[WASI Error]: ", err);
    }

    return wasi;
}

export async function runZigOutput(output: ArrayBuffer): Promise<WASI> {
    const wasmComp = await WebAssembly.compile(output);

    const args = ["input.wasm"];
    const env: string[] = [];
    const fds = [
        new OpenFile(new File([])), // stdin
        ConsoleStdout.lineBuffered((msg) => console.log(`[WASI stderr] ${msg}`)), // stdout
        ConsoleStdout.lineBuffered((msg) => console.log(`[WASI stderr] ${msg}`)), // stderr
        new PreopenDirectory(".", new Map([["input.wasm", new File(new Uint8Array(output))]])),
    ];
    const wasi = new WASI(args, env, fds);

    const instInput = await WebAssembly.instantiate(wasmComp, {
        wasi_snapshot_preview1: wasi.wasiImport,
    });

    try {
        // @ts-ignore
        wasi.start(instInput);
    } catch (err) {
        console.log("ERR: ", err);
        // return new TextDecoder().decode(wasiInput.fds[1].file.data)
    }

    return wasi;
}
