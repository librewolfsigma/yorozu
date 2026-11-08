import { describe, expect, test } from "bun:test";
import { isAllowedMediaUrl } from "@/lib/imgproxy";

describe("imgproxy allowlist — SSRF guard", () => {
  test("accepts allowlisted provider hosts", () => {
    expect(isAllowedMediaUrl("https://i1.nhentai.net/galleries/1/1.webp")).toBe(true);
    expect(isAllowedMediaUrl("https://files.iwara.tv/image/thumbnail/x/thumbnail-00.jpg")).toBe(true);
    expect(isAllowedMediaUrl("https://w1.hentaiocean.com/video/File.mp4")).toBe(true);
    expect(isAllowedMediaUrl("https://hmvmania.com/wp-content/uploads/2021/01/a.mp4")).toBe(true);
    expect(isAllowedMediaUrl("https://pmvhaven.com/thumb.webp")).toBe(true);
  });

  test("accepts rotating CDN hosts via suffix match", () => {
    expect(isAllowedMediaUrl("https://mp4-gcore.xvideos-cdn.com/a.mp4")).toBe(true);
    expect(isAllowedMediaUrl("https://vid-12.cdn.eporner.com/b.mp4")).toBe(true);
    expect(isAllowedMediaUrl("https://pmvhavencloud.s3.fr.io.cloud.ovh.net/c.mp4")).toBe(true);
    expect(isAllowedMediaUrl("https://asta.iwara.tv/view?hash=x")).toBe(true);
  });

  test("rejects non-https and unknown hosts", () => {
    expect(isAllowedMediaUrl("http://i1.nhentai.net/galleries/1/1.webp")).toBe(false);
    expect(isAllowedMediaUrl("https://evil.example.com/a.mp4")).toBe(false);
    expect(isAllowedMediaUrl("https://nhentai.net.evil.example.com/a.webp")).toBe(false);
  });

  test("rejects SSRF probe targets", () => {
    expect(isAllowedMediaUrl("https://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isAllowedMediaUrl("https://127.0.0.1/x")).toBe(false);
    expect(isAllowedMediaUrl("https://localhost/x")).toBe(false);
    expect(isAllowedMediaUrl("https://[::1]/x")).toBe(false);
    expect(isAllowedMediaUrl("file:///etc/passwd")).toBe(false);
  });

  test("rejects garbage", () => {
    expect(isAllowedMediaUrl("")).toBe(false);
    expect(isAllowedMediaUrl("not a url")).toBe(false);
  });
});
