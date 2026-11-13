import assert from "node:assert/strict";
import { test } from "node:test";

import { blockedPorts, configuredPorts, reservedRanges } from "../check-local-ports.mjs";

const NETSH = `
协议 tcp 端口排除范围

开始端口    结束端口
----------    --------
     54251       54350
     59979       60078
     50000       50059     *

* - 管理的端口排除。
`;

test("reads every port, disabled sections included, and skips other port keys", () => {
  const config = [
    "[api]",
    "enabled = false",
    "port = 54321",
    "[db]",
    "port = 54322 # database",
    "shadow_port = 54320",
    "[db.pooler]",
    "enabled = false",
    "port = 54329",
    "[edge_runtime]",
    "inspector_port = 8083",
  ].join("\n");
  assert.deepEqual(configuredPorts(config), [54321, 54322, 54329]);
});

test("finds configured ports inside Windows' reserved ranges", () => {
  const ranges = reservedRanges(NETSH);
  assert.deepEqual(ranges, [[54251, 54350], [59979, 60078], [50000, 50059]]);
  assert.deepEqual(blockedPorts([54321, 54322, 3101, 8792], ranges), [54321, 54322]);
  assert.deepEqual(blockedPorts([56321], ranges), []);
});
