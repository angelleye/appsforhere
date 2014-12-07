var storage = new (require('./storage'))(_email.replace('.', ''));
var locationManager = new (require('./location'))();
var invoiceManager = new (require('./invoiceManager'))(locationManager);
var orderManager = new (require('./savedOrders'))(locationManager, invoiceManager);
var checkin = new (require('./checkin'))(locationManager, invoiceManager);
var hardware = new (require('./hardware'))(locationManager);
var serverSocket = new (require('./serverSocket'))(hardware);
var catalog = new (require('./catalog'))(invoiceManager);
var payment = new (require('./payment'))(locationManager, invoiceManager, checkin);
var cart = new (require('./cart'))(invoiceManager, checkin, payment);
var customerInfo = new (require('./customerInfo'))(invoiceManager, cart, checkin, locationManager);
var receipt = new (require('./receipt'))(invoiceManager);

// TODO this was basically completely refactored from a really long "procedural" javascript
// implementation. So there are still all sorts of artifacts of that in the object structures.
// We need to go one by one and just rethink the proper interface for each of these managers
// and add more event triggering, etc. But don't think that this structure is the "intent,"
// it's just a simple division of a big ball of code.
$(function () {
    locationManager.getBrowserLocation();
    [
        invoiceManager,
        cart,
        locationManager,
        hardware,
        catalog,
        orderManager,
        serverSocket,
        checkin,
        payment,
        customerInfo,
        receipt
    ].forEach(function (m) {
            m.setup(storage);
        });

    // Wire up event routing

    // When there is a hardware device selected, we need the web socket up
    hardware.on('changed', function (e, device) {
        serverSocket.attach(device);
        serverSocket.connect();
    });

    // Let the server know about order changes when the socket is up
    cart.on('render', function () {
        serverSocket.sendIfOpen('activeOrder', {inv: this.invoiceManager.deepFreeze(), tot: tots});
    });

    // When we're ready to take payment
    cart.on('selectingPaymentType', function (e, totals) {
        if (hardware.device) {
            serverSocket.subscribe(totals.total.toString());
        }
    });

    payment.on('hidden', function (e) {
        serverSocket.unsubscribe();
    });

    locationManager.on('selected', function () {
        hardware.load();
        checkin.ensurePolling();
        orderManager.update();
    });

    serverSocket.on('deviceEvent', function (e, args) {
        if (args.type === 'Swipe') {
            payment.swipeDetected({
                ksn: args.data.ksn,
                serial: args.data.ksn,
                vendor: args.data.vendor,
                track1: args.data.track1,
                track2: args.data.track2,
                track2Masked: args.data.track2Masked
            });
        }
    });

    $('[data-toggle="tooltip"]').tooltip();

});
