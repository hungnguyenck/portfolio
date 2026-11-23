# Portfolio của CK: hướng dẫn quản lý và mở rộng

Website này là một **site tĩnh**: nội dung nằm trong các file JSON (`content/`), một script (`tools/build.mjs`) ghép chúng thành HTML, GitHub Pages đăng lên mạng miễn phí. Bạn sửa nội dung bằng **trang CMS** (`/admin/`), không cần đụng code.

```
content/            ← TOÀN BỘ nội dung (CMS sửa các file này)
  hero.json  site.json  experience.json  skills.json
  projects/*.json   ← mỗi project 1 file (thẻ lớn + trang riêng + "More things I shipped")
  posts/*.json      ← bài blog
  products/*.json   ← sản phẩm affiliate dùng lại trong nhiều bài
assets/
  css/style.css  js/main.js   ← giao diện + hành vi dùng chung cho mọi trang
  uploads/                    ← ảnh (CMS upload vào đây)
admin/              ← trang CMS (index.html + config.yml)
tools/build.mjs     ← bộ ghép trang (không cần cài gì thêm)
.github/workflows/deploy.yml ← tự build + đăng lên GitHub Pages
```

---

## PHẦN A. Tạo tài khoản và đưa website lên mạng (làm 1 lần, ~20 phút)

### A1. Tạo tài khoản GitHub
1. Vào **github.com** → **Sign up**.
2. Nhập email, mật khẩu, **username**. Username sẽ nằm trong link website (`https://username.github.io/...`), nên chọn tên gọn, viết thường.
3. Xác minh email (GitHub gửi mã) → chọn gói **Free**.
4. Nên bật xác thực 2 lớp: avatar → **Settings** → **Password and authentication** → **Enable two-factor authentication**. Lưu recovery codes ở nơi an toàn.

### A2. Tạo repository (kho chứa website)
1. Góc trên phải bấm **+** → **New repository**.
2. **Repository name**: `portfolio` (hoặc đặt đúng `username.github.io` nếu muốn link gốc không có `/portfolio`).
3. Chọn **Public** (GitHub Pages miễn phí cần repo Public). Nội dung website vốn đã công khai nên không có gì lộ thêm.
4. **Create repository**.

### A3. Đưa code lên repo
**Cách dễ nhất: GitHub Desktop**
1. Tải **desktop.github.com**, cài, đăng nhập tài khoản GitHub.
2. **File → Clone repository** → chọn `portfolio` → chọn thư mục trên máy.
3. Giải nén file zip tôi gửi, **copy toàn bộ nội dung bên trong** (kể cả thư mục `.github`, là thư mục ẩn: trên Mac bấm `⌘ + Shift + .` để hiện) vào thư mục vừa clone.
4. Trong GitHub Desktop: ô Summary gõ `first version` → **Commit to main** → **Push origin**.

*Cách khác (không cài gì):* trang repo → **Add file → Upload files** → kéo thả các thư mục `content`, `assets`, `admin`, `tools` và các file lẻ (`package.json`, `HUONG-DAN.md`, `.gitignore`) → Commit. Riêng workflow: **Add file → Create new file** → ở ô tên gõ `.github/workflows/deploy.yml` → dán nội dung file đó → Commit.

### A4. Bật GitHub Pages
1. Repo → **Settings** → **Pages** (cột trái).
2. **Build and deployment → Source** chọn **GitHub Actions**.
3. Vào tab **Actions**: thấy chạy "Deploy site" (chấm vàng → dấu tích xanh, ~1–2 phút). Nếu chưa chạy, bấm **Run workflow**.
4. Website ở: `https://username.github.io/portfolio/` (xem link ở Settings → Pages).

Nếu Actions báo lỗi đỏ, bấm vào lần chạy đó, chụp màn hình dòng lỗi gửi lại cho tôi.

---

## PHẦN B. Dùng CMS

### B1. Trỏ CMS vào repo của bạn (1 lần)
Mở `admin/config.yml` trên GitHub (bấm file → biểu tượng cây bút), đổi **3 chỗ** `USERNAME/REPO` thành `username/portfolio` (ví dụ `hungnguyen/portfolio`) và link `site_url`, `display_url`. **Commit changes**.

### B2. Tạo token để đăng nhập CMS (1 lần)
CMS cần quyền ghi vào repo của bạn. Cách đơn giản nhất không cần server riêng là dùng token cá nhân:
1. Avatar → **Settings** → cuối cột trái **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Token name**: `cms`. **Expiration**: chọn thời hạn (tối đa 1 năm; hết hạn thì tạo token mới).
3. **Repository access** → **Only select repositories** → chọn `portfolio`.
4. **Permissions → Repository permissions → Contents → Read and write**.
5. **Generate token** → **copy ngay** (chỉ hiện 1 lần). Đừng gửi cho ai, đừng dán vào chat.

### B3. Đăng nhập và sửa
1. Mở `https://username.github.io/portfolio/admin/` → **Sign in with token** → dán token. Token được lưu trong trình duyệt của bạn.
2. Sửa nội dung → bấm **Save** (hoặc **Publish**). CMS ghi 1 commit vào repo, GitHub Actions build lại, **sau ~1–2 phút** website cập nhật. Theo dõi ở tab Actions.

### B4. Mỗi mục nằm ở đâu trong CMS
| Muốn sửa | Vào | Ghi chú |
|---|---|---|
| Full story, Summary, 4 số ở Hero | **Trang chủ → Hero** | 3 bộ số: Marketing (cam), Product (xanh), Balanced (sáng), mỗi bộ đúng 4 số |
| Email, LinkedIn, Spotify, bật/tắt blog, số thẻ lớn | **Trang chủ → Cài đặt chung** | |
| Kinh nghiệm, kỹ năng | **Trang chủ → Experience / Skills** | |
| Project | **Projects** | tiêu đề, vai trò, thời gian, công ty, thumbnail 1:1, slides 16:9, 1–4 metrics, mô tả |
| Bài blog | **Blog posts** | nội dung viết bằng Markdown (có thanh công cụ) |
| Sản phẩm affiliate | **Sản phẩm affiliate** | tạo 1 lần, dùng lại nhiều bài |

### B5. Quy tắc thứ tự Project và "More things I shipped"
- Mỗi project có 3 ô **Thứ tự** (Marketing / Product / Balanced). **Số nhỏ = lên trước**, mỗi view sắp xếp riêng.
- **N project đầu** (có thumbnail) là thẻ lớn. N mặc định 5, chỉnh ở *Cài đặt chung → Số thẻ project lớn*.
- Mọi project còn lại, hoặc project **không có thumbnail**, hiện ở **More things I shipped**. Bấm vào mở **trang riêng** của project (`/work/ten-project/`).
- Muốn đẩy 1 project xuống More: tăng số thứ tự của nó lên lớn hơn các project khác (hoặc giảm số của project khác).
- Thẻ lớn cũng có nút **OPEN FULL PAGE** trong cửa sổ chi tiết.

### B6. Thêm Spotify
1. Spotify → mở playlist → **⋯** → **Share** → **Copy link to playlist**.
2. CMS → Cài đặt chung → **Spotify playlist** → bật **Bật mục Spotify** → thêm playlist, dán link → Save.
Mục "Playlist" và menu tự xuất hiện. Nhận cả album, bài hát, podcast.

### B7. Viết blog có link affiliate (Shopee, Amazon...)
1. Đăng ký chương trình affiliate (Shopee Affiliate, Amazon Associates...). Đọc kỹ quy định từng chương trình; Amazon yêu cầu câu công khai riêng, sửa ở *Lời công khai affiliate*.
2. CMS → **Sản phẩm affiliate** → New: tên, sàn, **link affiliate**, ảnh vuông, giá, ghi chú.
3. CMS → **Blog posts** → New: viết bài. Chọn sản phẩm ở ô *Sản phẩm affiliate trong bài* (hiện khung cuối bài), hoặc chèn giữa bài bằng một dòng riêng:
   `[[product:ten-file-san-pham]]`
   (tên file là phần slug hiện trong CMS, ví dụ `example-product`).
4. Bật **Đăng bài** (mặc định là nháp) → Save.
Nút mua có `rel="sponsored nofollow"` và bài tự hiện dòng công khai affiliate. Link chưa kiểm duyệt nên bạn chịu trách nhiệm với nội dung và quy định của chương trình.

Bài mẫu `example-post` đang ở trạng thái nháp để bạn xem cách làm; xóa hoặc sửa tùy ý.

### B8. Ảnh
Chọn đúng tỉ lệ để trang không bị giật: thumbnail **1:1** (800×800), slide **16:9** (1920×1080 hoặc 1120×630), ảnh bìa blog 16:9. Nén ảnh trước khi upload (squoosh.app hoặc tinypng.com): thumbnail dưới ~150KB, slide dưới ~300KB. CMS chưa tự nén ảnh.

### B9. Viết nội dung project: xuống dòng, ảnh, YouTube
Các ô **Challenge**, **What I did** và **Nội dung thêm** của Project (và nội dung Blog) là trình soạn thảo có thanh công cụ:
- **Enter** = xuống dòng/đoạn mới. Có gạch đầu dòng, đánh số, chữ đậm, link, tiêu đề.
- **Ảnh**: nút **Image** trên thanh công cụ (ảnh lưu vào `assets/uploads`, nhớ nén trước).
- **YouTube**: dán link video **trên 1 dòng riêng** (youtube.com/watch?v=..., youtu.be/..., shorts), hoặc bấm nút **YouTube**. Dòng đó hiện thành khung video 16:9. Muốn bắt đầu ở giây thứ 90: thêm `?t=90` vào link.
- Cửa sổ chi tiết ở trang chủ hiện Challenge/What I did/Results; phần **Nội dung thêm** chỉ hiện ở trang riêng của project (nút OPEN FULL PAGE).

### B10. Hero: phần mặc định và Spotify
- *Trang chủ → Hero → Phần giới thiệu mặc định*: chọn Full story hoặc Summary hiện sẵn khi mở trang.
- *Cài đặt chung → Spotify → Vị trí hiển thị*: "Dưới ảnh ở Hero" (player đầu tiên) hoặc "Mục riêng bên dưới" (nhiều playlist).

---

## PHẦN C. Chạy thử trên máy (không bắt buộc)
Cần Node.js 18 trở lên (nodejs.org). Trong thư mục dự án: `npm run dev` rồi mở `http://localhost:8080`. Sửa file trong `content/` là trang tự build lại. `npm run build` tạo thư mục `dist/`. Build in cảnh báo nếu thiếu ảnh hoặc sản phẩm.

---

## PHẦN D. Mở rộng sau này: cái gì nằm ở đâu

| Muốn thêm | Làm gì |
|---|---|
| Nội dung mới (project, bài, sản phẩm) | Chỉ dùng CMS, không cần code |
| Một **loại trang mới** (Shop, Books, Photos như samdickie.me) | 1) Thêm thư mục `content/<loại>/` + một collection trong `admin/config.yml`. 2) Thêm hàm trang trong `tools/build.mjs` (copy hàm `blogPages` làm mẫu). 3) Thêm link vào hàm `header()` |
| Một **mục mới ở trang chủ** (Newsletter, Podcast, Photos) | Thêm 1 khối `sections.push(...)` trong hàm `home()` + cờ bật/tắt trong `site.json` (xem mục Spotify làm mẫu) |
| Đổi màu, font, giao diện | `assets/css/style.css` (biến màu ở đầu file) |
| Tên miền riêng | Tạo file `CNAME` ở thư mục gốc chứa tên miền, cài DNS theo hướng dẫn GitHub Pages, điền *Địa chỉ website* trong CMS |
| Đa ngôn ngữ, tìm kiếm ⌘K, newsletter | Thêm sau; cấu trúc hiện tại cho phép (mỗi trang là một hàm độc lập) |

**Nguyên tắc giữ cho dễ mở rộng:** nội dung chỉ ở `content/`, giao diện chỉ ở `assets/`, logic ghép trang chỉ ở `tools/`. Không dán nội dung thẳng vào HTML.

## Giới hạn cần biết
- GitHub Pages là hosting tĩnh: không có đăng nhập người dùng, bình luận hay cơ sở dữ liệu. Form liên hệ, newsletter hoặc bình luận cần dịch vụ ngoài (Formspree, Substack, Giscus...).
- Mỗi lần Save, website cần ~1–2 phút để lên.
- Token CMS là chìa khóa ghi vào repo: lộ token thì vào Settings → Developer settings → xóa token và tạo cái mới.
