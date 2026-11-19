// Run with /usr/bin/osascript -l JavaScript pet.js. See the macOS adapter README for commands.
ObjC.import('AppKit');
ObjC.import('CoreGraphics');
ObjC.import('Security');

const fm = $.NSFileManager.defaultManager;
const SIDE = 96;
const INSET = 12;
const CARD_WIDTH = 160;
const CARD_TTL = 5000;
const hostID = 'com.openai.codex';
const signingRequirement = 'anchor apple generic and identifier "com.openai.codex" and certificate leaf[subject.OU] = "2DC432GLL2"';
let state, assets, app, panel, view, portrait, cardPanel, controller, timer;
let cardUntil = 0, cardPhrase = '', cardRows = [], cardHeight = 0, latestQuota = null;
let anchor = null, slot = 0, drag = null, currentHost = null, cachedIdentity = null;
let lastRead = 0, lastHeartbeat = 0, lastStatus = '', lastStatusTime = 0, enabled = true;

function environment(key) {
    const value = ObjC.unwrap($.NSProcessInfo.processInfo.environment.objectForKey(key));
    if (typeof value !== 'string' || !value.startsWith('/')) throw Error('Missing absolute path in ' + key);
    return value.replace(/\/$/, '');
}
function readJSON(name) {
    const data = $.NSData.dataWithContentsOfFile(state + '/' + name);
    if (data.isNil()) return null;
    try { return JSON.parse(ObjC.unwrap($.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding))); }
    catch (_) { return null; }
}
function writeText(name, value) {
    if (!$(value).writeToFileAtomicallyEncodingError(state + '/' + name, true, $.NSUTF8StringEncoding, null)) {
        throw Error('Cannot write Work Pet state file ' + name);
    }
}
function remove(name) {
    const path = state + '/' + name;
    if (fm.fileExistsAtPath(path) && !fm.removeItemAtPathError(path, null)) throw Error('Cannot remove ' + name);
}
function clamp(value) { return Math.max(0, Math.min(1, value)); }
function readAnchor() {
    const a = readJSON('anchor.json');
    return a && Number.isFinite(a.x) && Number.isFinite(a.y) ? {x: clamp(a.x), y: clamp(a.y)} : null;
}
function slotFile(index) { return state + '/role-' + (index + 1) + '.image'; }
function loadPortrait() {
    const custom = $.NSImage.alloc.initWithContentsOfFile(slotFile(slot));
    const img = !custom.isNil() && custom.isValid ? custom : $.NSImage.alloc.initWithContentsOfFile(assets + '/IMG3576.png');
    if (img.isNil() || !img.isValid) throw Error('Cannot load the bundled character image');
    portrait.image = img;
}
function selectSlot(index) {
    slot = index;
    writeText('role.json', JSON.stringify({slot: index}));
    loadPortrait();
}
// Match the original widget: four role slots, with the bundled portrait as fallback.
function clickRole() {
    selectSlot((slot + 1) % 4);
    const previous = readJSON('clicks.json') || {};
    let goal = previous.goal;
    if (!Number.isInteger(goal) || goal < 2 || goal > 5) goal = 2 + Math.floor(Math.random() * 4);
    let count = Number.isInteger(previous.count) && previous.count >= 0 && previous.count < goal ? previous.count + 1 : 1;
    cardPhrase = '';
    if (count === goal) {
        const phrases = ['好模型…', '用不起别用', 'Tibo…', '你不会把ds接进来的对吧…', 'kskbl', 'zdjd'];
        cardPhrase = phrases[Math.floor(Math.random() * phrases.length)];
        count = 0;
        goal = 2 + Math.floor(Math.random() * 4);
    }
    writeText('clicks.json', JSON.stringify({count, goal}));
    cardUntil = Date.now() + CARD_TTL;
    updateCard(Date.now());
}
function chooseImage(index) {
    const picker = $.NSOpenPanel.openPanel;
    picker.title = '为角色 ' + (index + 1) + ' 选择图片';
    picker.allowsMultipleSelection = false;
    picker.canChooseDirectories = false;
    picker.allowedFileTypes = ['png', 'jpg', 'jpeg'];
    picker.level = Number($.NSFloatingWindowLevel) + 1;
    if (Number(picker.runModal) !== Number($.NSModalResponseOK)) return;
    const selected = picker.URL;
    const bytes = $.NSData.dataWithContentsOfURL(selected);
    if (bytes.isNil()) return;
    const img = $.NSImage.alloc.initWithData(bytes);
    if (img.isNil() || !img.isValid || !bytes.writeToFileAtomically(slotFile(index), true)) { $.NSBeep(); return; }
    selectSlot(index);
}
function quotaRows(data, now) {
    if (!data || data.status !== 'fresh' || !Number.isFinite(data.at) ||
        now - data.at > 300000 || data.at > now + 5000 || !Array.isArray(data.windows)) return [];
    const minutes = ['pro', 'prolite'].includes(data.plan) ? [10080] : [300, 10080];
    const parts = [];
    for (const m of minutes) {
        const matches = data.windows.filter(w => w && w.minutes === m);
        if (matches.length !== 1) continue;
        const w = matches[0];
        if (w.status !== 'fresh' || !Number.isFinite(w.remaining) || w.remaining < 0 || w.remaining > 100) continue;
        if (w.resetsAt !== undefined && (!Number.isFinite(w.resetsAt) || w.resetsAt * 1000 <= now)) continue;
        parts.push({label: m === 300 ? '五小时' : '每周', value: (Math.round(w.remaining * 10) / 10) + '%'});
    }
    if (Number.isSafeInteger(data.resetCount) && data.resetCount >= 0)
        parts.push({label: '剩余重置', value: data.resetCount + ' 次'});
    return parts;
}
function signedHost(front) {
    if (front.isNil() || ObjC.unwrap(front.bundleIdentifier) !== hostID) return false;
    const pid = Number(front.processIdentifier);
    const launched = Number(front.launchDate.timeIntervalSince1970);
    if (cachedIdentity && cachedIdentity.pid === pid && cachedIdentity.launched === launched) return cachedIdentity.ok;
    const code = Ref(), req = Ref();
    // Check the signing requirement and main executable once per process launch.
    const ok = $.SecStaticCodeCreateWithPath(front.bundleURL, 0, code) === 0 &&
        $.SecRequirementCreateWithString($(signingRequirement), 0, req) === 0 &&
        $.SecStaticCodeCheckValidity(code[0], $.kSecCSDoNotValidateResources, req[0]) === 0;
    cachedIdentity = {pid, launched, ok};
    return ok;
}
function windowsOnScreen() {
    const info = $.CGWindowListCopyWindowInfo(Number($.kCGWindowListOptionOnScreenOnly) |
        Number($.kCGWindowListExcludeDesktopElements), $.kCGNullWindowID);
    return ObjC.castRefToObject(info);
}
function winValue(entry, key) { return ObjC.unwrap(entry.objectForKey(key)); }
function findHost() {
    const front = $.NSWorkspace.sharedWorkspace.frontmostApplication;
    if (!signedHost(front)) return null;
    const pid = Number(front.processIdentifier), list = windowsOnScreen();
    if (!list || list.isNil()) return null;
    // WindowServer returns front-to-back order. Read only geometry and ownership.
    for (let i = 0; i < Number(list.count); i++) {
        const w = list.objectAtIndex(i);
        if (winValue(w, 'kCGWindowOwnerPID') !== pid || winValue(w, 'kCGWindowLayer') !== 0 ||
            winValue(w, 'kCGWindowAlpha') <= 0.01 || !winValue(w, 'kCGWindowIsOnscreen')) continue;
        const b = ObjC.deepUnwrap(w.objectForKey('kCGWindowBounds'));
        if (b.Width < 320 || b.Height < 200) continue;
        // CG and AppKit share the primary display origin but their Y axes point in opposite directions.
        const primary = $.NSScreen.screens.firstObject.frame;
        return {x: b.X, y: primary.size.height - b.Y - b.Height, width: b.Width, height: b.Height};
    }
    return null;
}
function panelOnScreen(number, pid) {
    if (!Number.isInteger(number) || !Number.isInteger(pid)) return false;
    const list = windowsOnScreen();
    if (!list || list.isNil()) return false;
    for (let i = 0; i < Number(list.count); i++) {
        const w = list.objectAtIndex(i);
        if (winValue(w, 'kCGWindowNumber') === number && winValue(w, 'kCGWindowOwnerPID') === pid) return true;
    }
    return false;
}
function place(host, position) {
    const x = Math.round(position ? host.x + (host.width - SIDE) * position.x : host.x + host.width - SIDE - INSET);
    const y = Math.round(position ? host.y + (host.height - SIDE) * position.y : host.y + INSET);
    const origin = panel.frame.origin;
    if (origin.x !== x || origin.y !== y) panel.setFrameOrigin($.NSMakePoint(x, y));
}
// Use the same aspect-fit rectangle as the image view, including transparent pixels in custom images.
function hitsPortrait(point) {
    const image = portrait.image, size = image.size;
    const scale = Math.min(SIDE / size.width, SIDE / size.height);
    const w = size.width * scale, h = size.height * scale;
    const rect = $.NSMakeRect((SIDE - w) / 2, (SIDE - h) / 2, w, h);
    return image.hitTestRectWithImageDestinationRectContextHintsFlipped(
        $.NSMakeRect(point.x, point.y, 1, 1), rect, $.NSGraphicsContext.currentContext, $.NSDictionary.dictionary, false);
}
function hideCard() {
    cardUntil = 0;
    if (cardPanel.isVisible) cardPanel.orderOut(null);
}
function cardRect(host, pet, height) {
    const x = Math.min(host.x + host.width - CARD_WIDTH - 4, Math.max(host.x + 4, pet.x + SIDE - CARD_WIDTH));
    const above = pet.y + SIDE + 6;
    const y = above + height <= host.y + host.height - 4 ? above : Math.max(host.y + 4, pet.y - height - 6);
    return $.NSMakeRect(x, y, CARD_WIDTH, height);
}
function updateCard(now) {
    if (!cardUntil) return;
    if (!currentHost || drag || now >= cardUntil) { hideCard(); return; }
    const rows = quotaRows(latestQuota, now);
    const height = 16 + 21 * (cardPhrase ? 1 : Math.max(1, rows.length));
    cardRows = rows;
    cardHeight = height;
    const rect = cardRect(currentHost, panel.frame.origin, height);
    const frame = cardPanel.frame;
    if (frame.origin.x !== rect.origin.x || frame.origin.y !== rect.origin.y || frame.size.height !== height)
        cardPanel.setFrameDisplay(rect, true);
    cardPanel.contentView.needsDisplay = true;
    if (!cardPanel.isVisible) cardPanel.orderFrontRegardless;
}
function tint(red, green, blue) {
    return $.NSColor.colorWithCalibratedRedGreenBlueAlpha(red/255, green/255, blue/255, 1);
}
function drawCard() {
    const rect = $.NSMakeRect(0.5, 0.5, CARD_WIDTH - 1, cardHeight - 1);
    const path = $.NSBezierPath.bezierPathWithRoundedRectXRadiusYRadius(rect, 10, 10);
    tint(249, 253, 247).setFill; path.fill;
    tint(177, 197, 174).setStroke; path.lineWidth = 1; path.stroke;
    const draw = (text, y, align, bold) => {
        const attrs = $.NSMutableDictionary.dictionary;
        attrs.setObjectForKey(bold ? $.NSFont.boldSystemFontOfSize(13) : $.NSFont.systemFontOfSize(13), $.NSFontAttributeName);
        attrs.setObjectForKey(tint(35, 65, 62), $.NSForegroundColorAttributeName);
        const string = $(text);
        const size = string.sizeWithAttributes(attrs);
        const x = align === 'center' ? (CARD_WIDTH-size.width)/2 : align === 'right' ? CARD_WIDTH-12-size.width : 12;
        string.drawAtPointWithAttributes($.NSMakePoint(Math.round(x), Math.round(y-size.height/2)), attrs);
    };
    if (cardPhrase || !cardRows.length) {
        draw(cardPhrase || '额度暂不可用', cardHeight/2, 'center', Boolean(cardPhrase));
    } else {
        cardRows.forEach((row, index) => {
            const y = cardHeight - 8 - (index + 0.5)*21;
            draw(row.label, y, 'left', false);
            draw(row.value, y, 'right', true);
        });
    }
}
function endDrag() {
    if (!drag) return;
    if (drag.moved) writeText('anchor.json', JSON.stringify(anchor));
    const clicked = !drag.moved;
    drag = null;
    if (clicked) clickRole();
}
function moveDrag() {
    if (!drag || !currentHost) return;
    const cursor = $.NSEvent.mouseLocation;
    const dx = cursor.x - drag.mouse.x, dy = cursor.y - drag.mouse.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    anchor = {
        x: clamp((drag.origin.x + dx - currentHost.x) / (currentHost.width - SIDE)),
        y: clamp((drag.origin.y + dy - currentHost.y) / (currentHost.height - SIDE))
    };
    place(currentHost, anchor);
}
function action(menu, title, tag) {
    const item = $.NSMenuItem.alloc.initWithTitleActionKeyEquivalent(title, 'petAction:', '');
    item.tag = tag;
    item.target = controller;
    menu.addItem(item);
    return item;
}
function petMenu() {
    const menu = $.NSMenu.alloc.initWithTitle('角色');
    for (let i = 0; i < 4; i++) {
        const name = '角色 ' + (i + 1);
        const item = $.NSMenuItem.alloc.initWithTitleActionKeyEquivalent(name, null, '');
        item.state = slot === i ? 1 : 0;
        const submenu = $.NSMenu.alloc.initWithTitle(name);
        action(submenu, '使用此角色', i);
        action(submenu, '选择 PNG / JPEG 图片…', 4 + i);
        action(submenu, '恢复默认图片', 8 + i);
        item.submenu = submenu;
        menu.addItem(item);
    }
    menu.addItem($.NSMenuItem.separatorItem);
    action(menu, '恢复角色位置', 12);
    action(menu, '隐藏角色', 13);
    return menu;
}
function handleAction(tag) {
    if (tag < 4) selectSlot(tag);
    else if (tag < 8) chooseImage(tag - 4);
    else if (tag < 12) {
        remove('role-' + (tag - 7) + '.image');
        if (slot === tag - 8) loadPortrait();
    } else if (tag === 12) {
        remove('anchor.json');
        anchor = null;
    } else if (tag === 13) {
        writeText('hidden', '1\n');
        lastRead = 0;
        tick();
    }
}
function createPanel() {
    app = $.NSApplication.sharedApplication;
    app.setActivationPolicy($.NSApplicationActivationPolicyAccessory);
    ObjC.registerSubclass({
        name: 'WorkPetContent', superclass: 'NSView',
        methods: {
            'hitTest:': {implementation: function (point) { return hitsPortrait(point) ? this : undefined; }},
            'acceptsFirstMouse:': {types: ['bool', ['id']], implementation: function () { return true; }},
            'mouseDown:': {types: ['void', ['id']], implementation: function () {
                hideCard();
                drag = {mouse: $.NSEvent.mouseLocation, origin: panel.frame.origin, moved: false};
            }},
            'mouseDragged:': {types: ['void', ['id']], implementation: function () { moveDrag(); }},
            'mouseUp:': {types: ['void', ['id']], implementation: function () { endDrag(); }},
            'rightMouseDown:': {types: ['void', ['id']], implementation: function (event) {
                $.NSMenu.popUpContextMenuWithEventForView(petMenu(), event, this);
            }}
        }
    });
    ObjC.registerSubclass({
        name: 'WorkPetController', superclass: 'NSObject',
        methods: {
            'petAction:': {types: ['void', ['id']], implementation: function (item) { handleAction(Number(item.tag)); }},
            'refresh:': {types: ['void', ['id']], implementation: function () { tick(); }}
        }
    });
    ObjC.registerSubclass({
        name: 'WorkPetQuotaCard', superclass: 'NSView',
        methods: {'drawRect:': {implementation: function () { drawCard(); }}}
    });
    controller = $.WorkPetController.alloc.init;
    panel = $.NSPanel.alloc.initWithContentRectStyleMaskBackingDefer(
        $.NSMakeRect(0, 0, SIDE, SIDE), $.NSWindowStyleMaskNonactivatingPanel, $.NSBackingStoreBuffered, false);
    panel.opaque = false;
    panel.backgroundColor = $.NSColor.clearColor;
    panel.hasShadow = false;
    panel.hidesOnDeactivate = false;
    panel.becomesKeyOnlyIfNeeded = true;
    panel.level = $.NSFloatingWindowLevel;
    panel.collectionBehavior = Number($.NSWindowCollectionBehaviorCanJoinAllSpaces) |
        Number($.NSWindowCollectionBehaviorFullScreenAuxiliary) | Number($.NSWindowCollectionBehaviorIgnoresCycle);
    view = $.WorkPetContent.alloc.initWithFrame($.NSMakeRect(0, 0, SIDE, SIDE));
    panel.contentView = view;
    portrait = $.NSImageView.alloc.initWithFrame($.NSMakeRect(0, 0, SIDE, SIDE));
    portrait.imageScaling = $.NSImageScaleProportionallyUpOrDown;
    view.addSubview(portrait);
    cardPanel = $.NSPanel.alloc.initWithContentRectStyleMaskBackingDefer(
        $.NSMakeRect(0, 0, CARD_WIDTH, 37), $.NSWindowStyleMaskNonactivatingPanel, $.NSBackingStoreBuffered, false);
    cardPanel.opaque = false;
    cardPanel.backgroundColor = $.NSColor.clearColor;
    cardPanel.hasShadow = false;
    cardPanel.hidesOnDeactivate = false;
    cardPanel.level = panel.level;
    cardPanel.collectionBehavior = panel.collectionBehavior;
    cardPanel.ignoresMouseEvents = true;
    cardPanel.contentView = $.WorkPetQuotaCard.alloc.initWithFrame($.NSMakeRect(0, 0, CARD_WIDTH, 37));
    const saved = readJSON('role.json');
    slot = saved && Number.isInteger(saved.slot) && saved.slot >= 0 && saved.slot < 4 ? saved.slot : 0;
    loadPortrait();
}
function tick() {
    const now = Date.now();
    if (now - lastRead >= 800) {
        enabled = !fm.fileExistsAtPath(state + '/hidden');
        if (!drag) anchor = readAnchor();
        latestQuota = readJSON('quota.json');
        lastRead = now;
    }
    currentHost = enabled ? findHost() : null;
    if (currentHost) {
        place(currentHost, anchor);
        if (!panel.isVisible) panel.orderFrontRegardless;
        updateCard(now);
        if (now - lastHeartbeat >= 4000) {
            writeText('active', String(now) + '\n');
            lastHeartbeat = now;
        }
    } else {
        drag = null;
        hideCard();
        if (panel.isVisible) panel.orderOut(null);
        if (lastHeartbeat) { remove('active'); lastHeartbeat = 0; }
    }
    const status = {pid: Number($.NSProcessInfo.processInfo.processIdentifier),
        panelNumber: Number(panel.windowNumber), visible: Boolean(panel.isVisible), enabled, slot: slot + 1};
    const encoded = JSON.stringify(status);
    if (encoded !== lastStatus || now - lastStatusTime >= 4000) {
        writeText('pet-status.json', JSON.stringify(Object.assign({at: now}, status)));
        lastStatus = encoded;
        lastStatusTime = now;
    }
}
function probe() {
    const host = findHost();
    const status = readJSON('pet-status.json');
    const now = Date.now();
    const running = Boolean(status && now >= status.at && now - status.at < 10000 &&
        !$.NSRunningApplication.runningApplicationWithProcessIdentifier(status.pid).isNil());
    return {officialWindowFrontmost: Boolean(host), enabled: !fm.fileExistsAtPath(state + '/hidden'),
        running, visible: Boolean(running && status.visible && panelOnScreen(status.panelNumber, status.pid))};
}
function selfTest() {
    // Destructive checks exercise the same controls with isolated preferences and image slots.
    const original = state;
    state = ObjC.unwrap($.NSTemporaryDirectory()) + 'work-pet-test-' + ObjC.unwrap($.NSUUID.UUID.UUIDString);
    if (!fm.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(state, true, $.NSDictionary.dictionary, null)) {
        throw Error('Cannot create isolated self-test directory');
    }
    try { return exercisePanel(); }
    finally { fm.removeItemAtPathError(state, null); state = original; }
}
function exercisePanel() {
    const check = (ok, name) => { if (!ok) throw Error('Self-test failed: ' + name); };
    const waitFor = predicate => {
        const deadline = Date.now() + 750;
        do {
            if (predicate()) return true;
            $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(0.03));
        } while (Date.now() < deadline);
        return false;
    };
    createPanel();
    const now = Date.now(), windows = [300, 10080].map(minutes => ({minutes, remaining: 68, status: 'fresh'}));
    const sample = {status: 'fresh', at: now, windows};
    check(quotaRows(sample, now).map(r => r.value).join(',') === '68%,68%', 'fresh quota');
    check(quotaRows(Object.assign({}, sample, {plan: 'pro', resetCount: 0}), now).map(r => r.label).join(',') === '每周,剩余重置', 'Pro and zero reset count');
    check(!quotaRows(sample, now + 300001).length && !quotaRows(sample, now - 10000).length, 'expired snapshot');
    check(!quotaRows({status:'fresh', at:now, windows:[Object.assign({}, windows[0], {resetsAt:now/1000})]}, now).length, 'reset window');
    check(!cardPanel.isVisible && Number(view.subviews.count) === 1, 'portrait-only idle state');
    check(Number(app.activationPolicy) === Number($.NSApplicationActivationPolicyAccessory) && !panel.isOpaque &&
        (Number(panel.styleMask) & Number($.NSWindowStyleMaskNonactivatingPanel)) !== 0, 'accessory panel');
    check(portrait.image.isValid && Number(petMenu().numberOfItems) === 7 &&
        view.hitTest($.NSMakePoint(SIDE/2, SIDE/2)).isEqual(view) &&
        view.hitTest($.NSMakePoint(0, 0)).isNil(), 'role and settings menu');
    const file = $.NSData.dataWithContentsOfFile(assets + '/IMG3576.png');
    check(file.writeToFileAtomically(slotFile(1), true), 'test role image');
    // Keep all simulated interactions offscreen so this fixture never covers another app.
    currentHost = {x: -32000, y: -32000, width: 1000, height: 900};
    place(currentHost, null);
    latestQuota = sample;
    view.mouseDown(null); view.mouseUp(null);
    check(cardPanel.isVisible && cardRows.length === 2 && cardUntil > now, 'click shows fresh quota card');
    updateCard(cardUntil);
    check(!cardPanel.isVisible && cardUntil === 0, 'auto dismiss');
    check(slot === 1 && readJSON('role.json').slot === 1, 'click to cycle roles');
    petMenu().itemAtIndex(0).submenu.performActionForItemAtIndex(0);
    check(slot === 0 && portrait.image.isValid, 'select a role from its menu');
    view.mouseDown(null); view.mouseUp(null);
    check(slot === 1, 'cycle into custom slot');
    view.mouseDown(null); view.mouseUp(null);
    check(slot === 2, 'cycle into default-backed slot');
    view.mouseDown(null);
    drag.mouse = {x: $.NSEvent.mouseLocation.x - 90, y: $.NSEvent.mouseLocation.y - 100};
    view.mouseDragged(null); view.mouseUp(null);
    check(readJSON('anchor.json').x > 0 && !cardPanel.isVisible && !cardUntil, 'drag and save anchor without a card');
    handleAction(12);
    check(readJSON('anchor.json') === null, 'reset anchor');
    handleAction(9);
    check(!fm.fileExistsAtPath(slotFile(1)), 'reset role image');
    handleAction(13);
    check(!enabled && !panel.isVisible && fm.fileExistsAtPath(state + '/hidden'), 'hide role');
    remove('hidden');
    const host = findHost(), pid = Number($.NSProcessInfo.processInfo.processIdentifier);
    if (host) {
        place(host, null);
        panel.orderFrontRegardless;
        check(panel.isVisible && waitFor(() => panelOnScreen(Number(panel.windowNumber), pid)), 'visible panel in official window');
    } else {
        // Exercise ordering in an off-screen location without appearing above another application.
        panel.setFrameOrigin($.NSMakePoint(-32000, -32000));
        panel.orderFrontRegardless;
        check(panel.isVisible, 'test panel ordering');
    }
    panel.orderOut(null);
    check(!panel.isVisible && waitFor(() => !panelOnScreen(Number(panel.windowNumber), pid)), 'ordered-out panel');
    return {passed:true, accessory:true, bundledImage:true, menu:true, cycle:true, drag:true,
        reset:true, quotaChecks:true, windowServerAttached: Boolean(host), panelHide:true};
}
function run(argv) {
    state = environment('WORK_PET_STATE');
    assets = environment('WORK_PET_ASSETS');
    const mode = argv[0] || '--run';
    if (argv.length > 1) throw Error('Expected one operation');
    if (mode === '--probe') return JSON.stringify(probe());
    if (mode === '--self-test') return JSON.stringify(selfTest());
    if (!fm.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(state, true, $.NSDictionary.dictionary, null)) {
        throw Error('Cannot create Work Pet state directory');
    }
    if (mode === '--show') { remove('hidden'); return '已显示角色，打开官方 ChatGPT 窗口即可查看。'; }
    if (mode === '--hide') { writeText('hidden', '1\n'); return '已隐藏角色。'; }
    if (mode === '--reset-position') { remove('anchor.json'); return '已恢复角色位置。'; }
    if (mode !== '--run') throw Error('Unknown operation');
    createPanel();
    tick();
    timer = $.NSTimer.scheduledTimerWithTimeIntervalTargetSelectorUserInfoRepeats(0.30, controller, 'refresh:', null, true);
    app.run;
}
