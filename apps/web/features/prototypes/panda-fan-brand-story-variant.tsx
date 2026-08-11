import type { CSSProperties } from "react";
import { ArrowRight, Heart, MapPin, Network } from "lucide-react";

const photos = {
  lunLun: "https://api.zhipanda.com/media/releases/2026.07.20.1/media-lun-lun-a089c7f24bdfbc26-w1200.webp",
  yangYang: "https://api.zhipanda.com/media/releases/2026.07.20.1/media-yang-yang-8e30a6c81892cbde-w1200.webp",
  yaLun: "https://api.zhipanda.com/media/releases/2026.07.20.1/media-ya-lun-4006c2e608f8e671-w1200.webp",
} as const;

function photoStyle(url: string, position = "center"): CSSProperties {
  return {
    backgroundImage: `url("${url}")`,
    backgroundPosition: position,
  };
}

function BrandPhoto({
  src,
  label,
  className = "",
  position,
}: {
  src: string;
  label: string;
  className?: string;
  position?: string;
}) {
  return (
    <div
      className={`zp-proto-d-photo ${className}`}
      role="img"
      aria-label={label}
      style={photoStyle(src, position)}
    />
  );
}

export function PandaFanBrandStoryVariant() {
  return (
    <div className="zp-proto-page zp-proto-brand-story" data-variant="D">
      <section className="zp-proto-d-hero">
        <BrandPhoto
          src={photos.lunLun}
          label="伦伦的公开照片"
          className="zp-proto-d-hero-photo"
          position="center 30%"
        />
        <div className="zp-proto-d-hero-shade" />
        <div className="zp-proto-d-hero-nav" aria-label="原型品牌导航">
          <strong>吱熊猫</strong>
          <div>
            <button type="button">PANDAS</button>
            <button type="button">FAMILIES</button>
            <button type="button">PLACES</button>
            <button type="button">FOLLOW</button>
          </div>
          <span>ZH</span>
        </div>
        <div className="zp-proto-d-hero-copy">
          <p>THE PANDA WORLD</p>
          <h1>
            FROM ONE
            <br />
            PANDA TO A
            <br />
            WORLD OF
            <br />
            STORIES.
          </h1>
          <div className="zp-proto-d-hero-bottom">
            <p>从喜欢的一只熊猫开始，认识它的家族、生活地点和每一个值得记住的瞬间。</p>
            <button type="button">开始认识伦伦<ArrowRight aria-hidden="true" /></button>
          </div>
        </div>
        <div className="zp-proto-d-scroll-cue">SCROLL TO DISCOVER <span aria-hidden="true">↓</span></div>
      </section>

      <section className="zp-proto-d-intro">
        <div className="zp-proto-d-copy-shell">
          <p className="zp-proto-d-index">01 — EVERYDAY MOMENTS</p>
          <h2>SMALL MOMENTS,<br />BIG PANDA MEMORIES.</h2>
          <p className="zp-proto-d-intro-body">
            熊猫爱好者记住的不只是出生日期和地点，还有一张照片、一次迁居、一个家族成员，以及多年之后仍然熟悉的名字。
          </p>
        </div>
      </section>

      <section className="zp-proto-d-stories" aria-label="熊猫故事入口">
        <article className="zp-proto-d-story-card is-left is-tall">
          <BrandPhoto src={photos.lunLun} label="伦伦的公开照片" position="center 27%" />
          <div><span>01 / FAMILY</span><h3>伦伦与她的七个孩子</h3><p>从一只熊猫，走进一个跨越多年的家族故事。</p></div>
        </article>
        <article className="zp-proto-d-story-card is-right is-short">
          <BrandPhoto src={photos.yaLun} label="雅伦的公开照片" position="center 34%" />
          <div><span>02 / MOMENT</span><h3>认识家族中的新一代</h3><p>照片、名字和关系，让每一代都容易被记住。</p></div>
        </article>
        <article className="zp-proto-d-story-card is-left is-short">
          <BrandPhoto src={photos.yangYang} label="洋洋的公开照片" position="center 31%" />
          <div><span>03 / JOURNEY</span><h3>从亚特兰大到成都</h3><p>沿着生活地点，看见一只熊猫完整的旅程。</p></div>
        </article>
        <article className="zp-proto-d-story-card is-right is-tall">
          <BrandPhoto src={photos.yaLun} label="雅伦的公开照片" position="center 28%" />
          <div><span>04 / FOLLOW</span><h3>关注之后，故事继续</h3><p>新照片、生日和家族动态，成为下一次回来的理由。</p></div>
        </article>
      </section>

      <section className="zp-proto-d-black-statement">
        <div>
          <p>02 — BEYOND PROFILES</p>
          <h2>BEYOND<br />PANDA PROFILES,<br />INTO A WORLD<br />OF CONNECTIONS.</h2>
          <span>资料页只是开始。家族、地点、照片和关注关系，让熊猫世界真正连接起来。</span>
        </div>
      </section>

      <section className="zp-proto-d-world">
        <div className="zp-proto-d-copy-shell">
          <p className="zp-proto-d-index">03 — ONE WORLD, MANY WAYS IN</p>
          <h2>DISCOVER PANDAS<br />YOUR OWN WAY.</h2>
          <p className="zp-proto-d-intro-body">从名字、家族、地点或最近动态进入，每条路径都把你带向更多熊猫。</p>
        </div>
        <div className="zp-proto-d-color-grid">
          <article className="is-coral">
            <span>FAMILY</span>
            <Network aria-hidden="true" />
            <h3>沿家族认识更多熊猫</h3>
            <button type="button">打开家族故事<ArrowRight aria-hidden="true" /></button>
          </article>
          <article className="is-yellow">
            <span>PLACES</span>
            <MapPin aria-hidden="true" />
            <h3>看看它生活过的地方</h3>
            <button type="button">进入地点探索<ArrowRight aria-hidden="true" /></button>
          </article>
          <article className="is-blue">
            <span>FOLLOW</span>
            <Heart aria-hidden="true" />
            <h3>把喜欢变成持续关注</h3>
            <button type="button">查看关注动态<ArrowRight aria-hidden="true" /></button>
          </article>
        </div>
      </section>

      <section className="zp-proto-d-stage">
        <BrandPhoto src={photos.yangYang} label="洋洋的公开照片" className="zp-proto-d-stage-photo" position="center 34%" />
        <div className="zp-proto-d-stage-copy">
          <p>ONE PANDA CAN LEAD TO A WHOLE WORLD.</p>
          <h2>认识一只，<br />再遇见更多。</h2>
          <button type="button">随机认识一只熊猫<ArrowRight aria-hidden="true" /></button>
        </div>
      </section>

      <section className="zp-proto-d-metrics" aria-label="探索方式">
        <article><strong>FAMILY</strong><span>从亲属关系继续</span></article>
        <article><strong>PLACES</strong><span>从生活地点继续</span></article>
        <article><strong>MOMENTS</strong><span>从照片与动态继续</span></article>
      </section>

      <footer className="zp-proto-d-ending">
        <p>PANDA DISCOVERY STUDIO</p>
        <h2>吱熊猫<br /><span>ZHIPANDA</span></h2>
      </footer>
    </div>
  );
}
