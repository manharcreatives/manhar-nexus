MANHAR NEXUS Restaurant Operations Platform --- Product Architecture &
Ideation One Platform. Configure It Your Way.

Manhar Creatives Product Concept Document Version 1.0 • 23 August 2026

Terminology principle: Nexus intentionally uses its own product language
rather than mirroring terminology from any reference product. Common
hospitality concepts remain understandable, but the interface vocabulary
is designed as a distinct Manhar Nexus system. \# 1. Executive Product
Vision Manhar Nexus should not be positioned as another restaurant
checkouting application. It should be positioned as a configurable
Restaurant Operations Platform inside a larger Modular Hospitality
Management Platform. The core idea is simple: every restaurant should
get the same strong operational foundation, while the owner activates
only the capabilities that match the hospitality business. A small café,
a QSR, a family restaurant, a premium dine-in restaurant, a cloud
kitchen, and a multi-location chain should not need separate software.

  -----------------------------------------------------------------------
  North Star`<br>`{=html}Simple enough for a checkout associate to learn
  in one session. Fast enough for a busy dinner rush. Powerful enough for
  an owner to run the hospitality business. Flexible enough to configure
  without developer involvement.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

The WebCheckout video is useful as a reference because it demonstrates
the fundamental restaurant flow: dining table → service
associate/service associate service request → kitchen → preparation
status → serving → checkouting → payment → receipt, plus team, team
payout, operating costs and guest-oriented management. Manhar Nexus
should take that operational core and make it more configurable, more
role-specific, more transparent, and more useful for
management---without copying its screens, wording, or implementation. \#
2. Product Principles - CORE + MODULES + CONFIGURATION --- the platform
is one product, but each hospitality business gets a different enabled
capability set. - Speed over decoration --- Service Console and Kitchen
Operations Screen interfaces must prioritize large touch targets, low
clicks, clear status and immediate feedback. - Configure before
customize --- menu rules, taxes, discounts, printers, access roles,
service charges, operating hours and workflows should be settings, not
custom development. - One source of truth --- the same service request
should drive kitchen execution, checkouting, reporting and guest
history. - Role-specific simplicity --- a service associate should not
see accounting complexity; an owner should not have to use a service
associate interface. - Operational resilience --- the product must be
designed around rush-hour reality, mistakes, cancellations, network
interruptions and team changes. - Commercial discipline --- features
must earn their maintenance cost through guest value, retention, revenue
or differentiation. \# 3. What We Extracted from the WebCheckout
Reference The following capabilities are treated as reference-derived
requirements, not as copied product specifications.

  -----------------------------------------------------------------------
  Reference capability    Manhar Nexus            Target level
                          interpretation          
  ----------------------- ----------------------- -----------------------
  Service Associate /     Fast role-based service Core
  service associate       app for dining table    
  mobile service          and service request     
  requesting              operations              

  Dining Table-level      Live dining area/guest  Core
  service requests        session management with 
                          dining table states     

  Guest preference /      Preferences & Add-ons,  Core
  spicy level             variants, preferences   
                          and kitchen             
                          instructions            

  Service Request sent to Smart production        Core
  kitchen                 routing to one or more  
                          production areas        

  Kitchen Operations      Real-time Kitchen       Core
  Screen                  Operations Screen with  
                          station, priority and   
                          status control          

  Preparing / Ready       Configurable            Core
  workflow                item/service request    
                          lifecycle with          
                          timestamps              

  Ready status synced to  Real-time service       Core
  service associate       status and service      
                          associate notification  

  Additional / additional Add to existing guest   Core
  service rounds          session without         
                          creating a new guest    
                          visit                   

  Fast checkouting        One-screen checkouting  Core
                          workspace with smart    
                          defaults                

  Discounts               Controlled discounts    Core
                          with access rules and   
                          activity history trail  

  Payment option          Multiple payment option Core
                          types,                  
                          split/partial/shift     
                          reconciliation          
                          workflows               

  Counter Receipt         Configurable print      Core
  printing                profiles and receipt    
                          templates               

  Guest Relationship      Guest Profiles,         Important
                          history, preferences    
                          and consent             

  Expense management      Operating expense       Important
                          capture and approval    

  Team management         Team profiles, access   Important
                          roles, shifts and       
                          operational access      

  Team Payout-related     Team payout/shift       Later/optional
  management              reconciliation support; 
                          full payroll can remain 
                          later                   
  -----------------------------------------------------------------------

# 4. Manhar Nexus Restaurant Architecture --- Big Picture

The restaurant product should be understood as six connected layers of
work rather than a collection of unrelated menus.

  -----------------------------------------------------------------------
  Layer                   Purpose                 Primary users
  ----------------------- ----------------------- -----------------------
  1\. Hospitality         Hospitality Business    Owner / Admin
  Business Foundation     profile, locations,     
                          settings, taxes, access 
                          roles, access rules,    
                          branding                

  2\. Front of House      Dining Dining Tables,   Service Associate /
                          bookings, menu, service Service Associate /
                          associate service       Host
                          requesting, service     
                          workflow                

  3\. Kitchen Operations  Kitchen Operations      Kitchen Team
                          Screen, production      
                          routing, preparation,   
                          item availability,      
                          wastage signals         

  4\. Revenue Operations  Checkout & Invoicing,   Checkout Associate /
                          payments, discounts,    Manager
                          receipts, cash counter, 
                          refunds                 

  5\. Hospitality         Stock Control,          Manager / Owner
  Business Operations     purchases, vendors,     
                          operating costs, team,  
                          shift attendance        

  6\. Intelligence &      Hospitality Business    Owner / Manager
  Growth                  Intelligence, guest     
                          relationship, guest     
                          rewards, QR, direct     
                          digital service         
                          requesting, marketing   
  -----------------------------------------------------------------------

# 5. Restaurant Module Map

  -----------------------------------------------------------------------
  Module                              What it covers
  ----------------------------------- -----------------------------------
  A. Hospitality Business & Location  Hospitality Business profile,
  Setup                               location, operating hours, service
                                      types, taxes, numbering, branding

  B. Access & Responsibility          Owner, manager, checkout associate,
                                      service associate, chef, stock
                                      control, accountant and custom
                                      access roles

  C. Menu Management                  Categories, items, variants,
                                      add-ons, preference / add-ons,
                                      combos, pricing, availability

  D. Dining Space Management          Dining Area plans, dining dining
                                      tables, dining table states,
                                      merge/split, transfer, occupancy

  E. Service Team Service Console     Fast service request taking, dining
                                      table selection, preference /
                                      add-ons, notes, course control,
                                      send to kitchen

  F. Service Request Management       Service Request Lifecycle, holds,
                                      cancellations, transfers,
                                      additional rounds, status history

  G. Kitchen Operations Screen        Stations, queues, priorities,
                                      timers, preparation states,
                                      ready/served

  H. Checkout & Invoicing & Checkout  Checkout creation, taxes,
                                      discounts, service charge,
                                      split/merge checkouts

  I. Payments & Cash                  Cash/card/UPI/manual payment
                                      options, split payment, refunds,
                                      cash counter, shift reconciliations

  J. Printing & Devices               Counter Receipts, kitchen tickets
                                      where needed, printer profiles,
                                      device mapping

  K. Guest Relationship               Profiles, visit history,
                                      preferences, notes, feedback,
                                      consent

  L. Bookings & Queue Management      Bookings, seating, queue
                                      management, dining table
                                      allocation, no-show tracking

  M. Stock Control                    Stock, recipes, units, consumption,
                                      transfers, adjustments, low-stock
                                      alerts

  N. Procurement & Vendors            Purchase requests, purchase service
                                      requests, receiving, vendor
                                      balances

  O. Operating Costs                  Expense categories, checkouts,
                                      petty cash, approvals, recurring
                                      operating costs

  P. Team & Shift Attendance          Profiles, access roles, shifts,
                                      shift attendance, leave,
                                      operational performance

  Q. Offers & Rewards & Guest Rewards Coupons, offers, points,
                                      membership, birthday/visit
                                      campaigns

  R. Scan Menu & Digital Service      scan menu, dining table service
  Requesting                          requesting, configurable
                                      self-service

  S. Direct Digital Service Requests  Direct service requests,
                                      pickup/dispatch, service request
                                      acceptance, menu sync

  T. Dispatch Operations              Dispatch status, zones, charges,
                                      rider handoff, aggregator-ready
                                      model

  U. Hospitality Business             Sales, items, dining dining tables,
  Intelligence & Reports              kitchen, team, guests, stock
                                      control, profitability

  V. Alerts & Messaging               Kitchen alerts, low stock, booking
                                      reminders, management alerts

  W. Control & Activity History       Action history, discount approvals,
                                      void/refund logs, sensitive changes

  X. Integrations                     Payments, WhatsApp/SMS/email,
                                      accounting, dispatch channels,
                                      hardware
  -----------------------------------------------------------------------

# 6. Module A --- Hospitality Business & Location Setup

This is the foundation from which the rest of the restaurant is
configured. The goal is that an owner can create a new restaurant
without needing Manhar Creatives to manually change the product. -
Hospitality Business profile --- hospitality business name, legal name,
logo, address, phone, email, GST/tax identity where applicable, invoice
identity and guest-facing branding. - Location profile --- location
name, address, contact, operating hours, service types, dining map,
printers and location-specific settings. - Service modes --- dine-in,
takeaway, pickup, dispatch, room service if enabled. - Hospitality
Business rules --- rounding, invoice numbering, cancellation rules,
discount rules, service charge behavior and default payment options. -
Branding --- logo, receipt header/footer, scan menu branding,
guest-facing colors and location identity. - Operating calendar ---
normal hours, holidays, special hours and temporary closures.

  -----------------------------------------------------------------------
  UX principle`<br>`{=html}Setup should feel like onboarding a
  hospitality business, not configuring software. Use a guided checklist
  with progress: Hospitality Business → Location → Menu → Dining Dining
  Tables → Users → Printers → Test Service Request → Go Live.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

# 7. Module B --- Access & Responsibility

Restaurant software fails when every employee sees everything. Nexus
should make access rules understandable and operational.

  -----------------------------------------------------------------------
  Role                    Primary                 Default access
                          responsibilities        
  ----------------------- ----------------------- -----------------------
  Owner                   Hospitality Business    Everything
                          control and hospitality 
                          business intelligence   

  Location Manager        Daily location          Operations + reports
                          operations              

  Checkout Associate      Checkout & Invoicing    Checkout & Invoicing +
                          and payments            shift reconciliation

  Service Team            Dining Dining Tables    Dining Area + assigned
                          and service requests    service requests

  Host / Reception        Bookings and seating    Bookings + dining area

  Kitchen Team            Preparation             Kitchen Operations
                                                  Screen only

  Stock Control Manager   Stock and procurement   Stock Control +
                                                  purchases

  Accountant              Operating Costs and     Operating Costs +
                          financial reporting     financial reports

  Custom Role             Client-specific         Configured by owner
                          workflow                
  -----------------------------------------------------------------------

-   Permission granularity --- view, create, edit, cancel, discount,
    refund, void, export, approve and configure should be separable
    where valuable.
-   Approval access rules --- high discounts, refunds, checkout voids,
    stock adjustments and expense approvals can require manager
    authorization.
-   Temporary access --- support shift-based or temporary credentials
    rather than sharing accounts.
-   Visibility rules --- location and role scope should be explicit.
    \# 8. Module C --- Menu Management Menu is the commercial heart of a
    restaurant. Nexus should treat the menu as structured hospitality
    business data, not just a list of products.
-   Categories --- Breakfast, Starters, Main Course, Beverages,
    Desserts, etc.
-   Items --- name, short description, image, price, tax category,
    preparation time, kitchen station, availability.
-   Variants --- Half/Full, Small/Medium/Large, regular/premium, pack
    sizes.
-   Preferences & Add-ons --- extra cheese, toppings, spice level,
    cooking preference, sauces, sides.
-   Preference / Add-on rules --- required vs optional, single vs
    multiple selection, free vs paid.
-   Combos --- bundle multiple items under a single commercial offer.
-   Time-based menu --- breakfast/lunch/dinner menus and scheduled
    availability.
-   Location-specific pricing --- same item can have different prices or
    availability by location.
-   Availability Lock --- one-tap item disable when stock or kitchen
    capacity is unavailable.
-   Menu versioning --- scheduled price/menu changes so an owner can
    prepare changes in advance.

  -----------------------------------------------------------------------
  Advanced opportunity`<br>`{=html}Use one menu model to power Service
  Console, scan menu, direct digital service requesting and future
  dispatch channels. The owner should not maintain the same dish four
  times.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

# 9. Module D --- Dining Space Management

Dining Dining Tables should behave like live operational objects, not
static labels. - Visual dining map --- dining dining tables displayed by
section/dining area with configurable shape and seating capacity. -
Dining Table states --- Available, Occupied, Service Requesting,
Preparing, Ready-to-Serve, Checkout & Invoicing, Cleaning/Reset. - Guest
Session --- a continuous visit/session containing all rounds of service
requests and the final checkout. - Merge dining dining tables ---
combine dining dining tables for groups without losing service request
history. - Split/transfer --- move a dining table or selected items to
another dining table. - Guest count --- number of guests per dining
table for service and hospitality business intelligence. - Dining Table
notes --- VIP, child seat, accessibility or operational notes. -
Color/status intelligence --- visual status should be readable from a
distance. \# 10. Module E --- Service Team Service Console This should
be one of the fastest screens in the entire product. A service associate
should be able to take an service request while standing beside the
guest. Primary flow: Select dining table → Select items → Apply
preference / add-ons → Add note → Review → Send to kitchen. - Fast
dining table selection --- recent/assigned dining dining tables first,
with dining area view as an alternative. - Fast item search --- category
shortcuts, search, favorites and frequently service requested items. -
Preference / Add-on-first UX --- when an item has mandatory choices, the
app should guide the service associate instead of producing an invalid
service request. - Guest note --- free-text kitchen/service instruction
where appropriate. - Course control --- starter/main/dessert or custom
courses where the restaurant needs controlled firing. - Hold / send
later --- service associate can build an service request and decide when
to send it. - Additional service round --- new items append to the same
guest session. - Item status --- Preparing / Ready / Served visible
without calling the kitchen. - Alerts & Messaging --- ready items,
cancelled items, kitchen questions and manager requests.

  -----------------------------------------------------------------------
  3-click target`<br>`{=html}For a standard repeat service request:
  Dining Table → Item → Send. Everything else should be optional,
  contextual or remembered from configuration.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

# 11. Module F --- Service Request Management

The service request engine should support real restaurant behavior,
including mistakes and changes. - Service Request Lifecycle --- Draft →
Sent → Accepted → Preparing → Ready → Served → Closed. - Service Line
Lifecycle --- each item can have its own status even when the parent
service request remains open. - Additional service rounds --- round 2,
round 3, etc. remain linked to the same guest session. - Edit before
preparation --- quantity and preference / add-on changes when
permitted. - Cancel item/service request --- requires reason; may
require manager approval depending on state. - Item replacement ---
replace an unavailable item while preserving activity history history. -
Transfer service request --- move dining table/session or selected items
between dining dining tables/service associates. - Split service request
--- separate selected items for different guests or checkouts. - Combine
service requests --- combine compatible service groups. - Service
Timeline --- show who did what and when. \# 12. Module G --- Kitchen
Operations Screen Kitchen Operations Screen should be a first-class
module, not simply a screen that mirrors service requests. It should
help chefs prioritize work. - Production Areas --- e.g., Hot Kitchen,
Tandoor, Beverage, Dessert, Bakery. - Smart production routing --- items
route to the correct station based on menu configuration. - Queue views
--- New, Preparing, Ready, Delayed or custom views. - Priority --- rush
service requests, VIP, takeaway pickup time and manager-priority service
requests. - Timers --- elapsed preparation time and target preparation
time. - Item-level completion --- chef can mark individual items
ready. - Service Request grouping --- show related items from the same
dining table/service request together. - Availability Alert --- kitchen
can signal item unavailable and immediately stop new service requests
for it. - Delay reason --- record why an service request is late where
operational hospitality business intelligence matter. - Pass Control
Screen --- optional final quality-control screen before service. -
Audio/visual alerts --- configurable alerts without creating noisy
distractions.

  -----------------------------------------------------------------------
  Advanced difference from a basic Kitchen Operations
  Screen`<br>`{=html}Nexus should answer not only 'what is the next
  service request?' but also 'what should the kitchen prepare first,
  which station is blocking the dining table, and which items are
  becoming late?'
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

# 13. Module H --- Checkout & Invoicing & Checkout

Checkout & Invoicing must be fast enough for a rush but controlled
enough for financial accuracy. - Automatic checkout build --- checkout
is generated directly from the guest session. - Tax calculation ---
configured taxes should apply automatically based on item/hospitality
business rules. - Service charge --- optional and configurable. -
Discount --- percentage/fixed; item-level or checkout-level depending on
configuration. - Complimentary items --- zero-price/comp with mandatory
reason and permission. - Split checkout --- by item, quantity, guest or
equal amount. - Merge checkouts --- combine multiple checkout groups
when needed. - Hold checkout --- pause checkout without losing the guest
session. - Receipt Reissue --- authorized receipt reissue with clear
indication that it is a duplicate/receipt reissue. - Round-off ---
configurable and transparent. - Invoice modes --- guest invoice,
simplified receipt, hospitality business invoice depending on
configuration. \# 14. Module I --- Payments & Cash Management Payment is
not just a dropdown. It is a shift reconciliation workflow. - Payment
options --- cash, UPI, card, bank transfer, wallet or other configured
methods. - Split payment --- e.g., part cash + part UPI. - Partial
payment --- only if the hospitality business policy allows it. - Payment
reversal/refund --- controlled process with reason and authorization. -
Cash Counter --- opening cash, cash in/out, closing count and
variance. - Shift shift reconciliation --- checkout associate can close
a shift and hand over responsibility. - Payment reference --- store
transaction/reference number where relevant. - Shift Reconciliation
reconciliation --- expected vs collected by payment type.

  -----------------------------------------------------------------------
  Hospitality Business control`<br>`{=html}A checkout associate should
  not be able to silently delete a payment. Corrections should create a
  traceable reversal/refund trail.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

# 15. Module J --- Printing & Device Management

-   Receipt printers --- location-specific printer profiles.
-   Production Printers --- optional fallback for hospitality businesses
    not using Kitchen Operations Screen.
-   Printer routing --- beverage items to beverage printer; kitchen
    items to production printer.
-   Receipt templates --- branding, address, tax information, footer, QR
    or contact details.
-   Receipt Reissue control --- authorized receipt reissues with
    activity history visibility.
-   Device assignment --- which counter/device uses which printer
    profile. \# 16. Module K --- Guest Relationship Guest Relationship
    should be useful without becoming a bloated Guest Relationship.
-   Guest Profile --- name, phone, email, birthday if voluntarily
    provided, preferences and consent.
-   Visit history --- service requests, spend, frequency and last visit.
-   Preference memory --- spice preference, favorite items, seating
    preference, dietary notes where appropriate.
-   Feedback --- rating, complaint, compliment and resolution status.
-   Guest tags --- VIP, regular, corporate, birthday, high-value, etc.
-   Consent --- marketing communication preference should be explicit.
-   Quick recognition --- phone lookup during checkouting/booking
    without slowing down the checkout associate. \# 17. Module L ---
    Bookings & Queue Management Bookings should connect to the same
    dining area/dining table engine rather than become a separate
    calendar.
-   Booking creation --- date, time, guest count, contact, dining table
    preference and notes.
-   Dining Table allocation --- suggest suidining table dining dining
    tables based on capacity and availability.
-   Arrival --- convert booking into an active guest session.
-   No-show --- record outcome and optional reason.
-   Queue Management --- guest added when no suidining table dining
    table is available.
-   Estimated wait --- manager can communicate an approximate waiting
    time.
-   Reseating --- move booking to a different dining table without
    recreating it. \# 18. Module M --- Stock Control Management Stock
    Control should be introduced after the restaurant has a sdining
    table sales/menu workflow. It is powerful but operationally heavier.
-   Item master --- ingredients/raw materials, packaging and
    consumables.
-   Units --- kg, gram, litre, ml, piece, packet, bottle, etc.
-   Recipe / BOM --- menu item consumes defined ingredients.
-   Automatic consumption --- sales can reduce theoretical stock based
    on recipes.
-   Stock count --- manual physical stock count and variance.
-   Stock adjustment --- wastage, spoilage, damage, opening stock and
    corrections.
-   Low-stock alert --- threshold-based alerts.
-   Location transfer --- move stock between locations if enabled.
-   Batch/expiry --- later-stage capability for hospitality businesses
    where it matters.

  -----------------------------------------------------------------------
  Important product decision`<br>`{=html}Do not force stock control on
  every restaurant. It should be an optional module. A small café may
  only need menu + Service Console + checkouting, while a large
  restaurant needs recipe-driven stock control.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

# 19. Module N --- Procurement & Vendors

-   Vendor master --- contact, payment terms and supplied categories.
-   Purchase request --- team/manager requests required stock.
-   Purchase service request --- approved purchase commitment.
-   Goods receiving --- received quantity, shortage/damage and final
    accepted quantity.
-   Vendor checkout --- reference and amount.
-   Vendor balance --- what is owed and what has been paid.
-   Purchase history --- price trends and vendor comparison.
-   Preferred vendor --- suggest vendor based on configured item
    relationships. \# 20. Module O --- Operating Costs
-   Expense categories --- rent, electricity, gas, internet, repairs,
    cleaning, marketing, miscellaneous.
-   Expense entry --- amount, date, location, category, vendor, payment
    option and note.
-   Attachment --- optional checkout/receipt image.
-   Approval --- manager approval for selected categories or amounts.
-   Recurring operating costs --- monthly rent or subscriptions.
-   Expense dashboard --- actual spend by category and period. \# 21.
    Module P --- Team & Shift Attendance The video reference indicates
    team and team payout-related management. Nexus should avoid turning
    the first restaurant release into a full HR/payroll product.
-   Team profile --- name, role, location, contact and active status.
-   Operational role --- checkout associate, service associate, chef,
    manager, etc.
-   Shift --- scheduled start/end and assigned area where required.
-   Shift Attendance --- present, absent, late, leave.
-   Shift performance --- service requests handled, dining dining tables
    served or checkout associate shift reconciliation where useful.
-   Leave --- simple leave tracking.
-   Team Payout/payout support --- optional later module rather than a
    core restaurant Service Console dependency. \# 22. Module Q ---
    Offers & Rewards, Guest Rewards & Guest Growth
-   Discount rules --- item/category/checkout/guest/occasion-based.
-   Coupons --- code-based offers.
-   Happy hours --- time-based pricing/discount rules.
-   Guest Rewards points --- earn/redeem with configurable rules.
-   Membership --- guest membership tiers where commercially justified.
-   Birthday offers --- opt-in campaign.
-   Visit rewards --- e.g., reward after a defined number of visits.
-   Offer guardrails --- minimum checkout, maximum discount, date/time
    and usage limits. \# 23. Module R --- Scan Menu & Digital Service
    Requesting QR should be a channel, not a separate menu system.
-   scan menu --- scan → menu → item details → preference / add-ons →
    cart.
-   Dining Table-aware QR --- QR identifies dining table when the
    hospitality business enables dining table service requesting.
-   Self-service requesting --- guest submits service request without
    waiting for a service associate.
-   Team approval mode --- service request enters a review queue before
    kitchen submission.
-   Menu sync --- availability and prices come from the same master
    menu.
-   Upsell --- suggest add-ons or combos without being intrusive. \# 24.
    Module S --- Direct Digital Service Requests
-   Direct service requesting --- restaurant's own digital service
    request channel.
-   Pickup --- guest selects pickup time.
-   Dispatch --- guest selects dispatch where enabled.
-   Service Request acceptance --- restaurant accepts/rejects with
    configured reasons.
-   Kitchen integration --- online service requests enter the same
    kitchen workflow.
-   Menu synchronization --- same source menu with channel-specific
    availability.
-   Guest record --- online guests can become Guest Relationship
    profiles with consent. \# 25. Module T --- Dispatch Operations
    Dispatch should initially be a simple operational layer, not a full
    logistics company.
-   Dispatch zones --- areas and configurable charges.
-   Service Request stages --- Accepted → Preparing → Ready → Picked Up
    → Out for Dispatch → Delivered.
-   Pickup handoff --- record who collected the service request.
-   Dispatch notes --- address and guest instructions.
-   Later integrations --- third-party dispatch channels can plug into
    the same service request model. \# 26. Module U --- Hospitality
    Business Intelligence & Reports Hospitality Business Intelligence
    should answer hospitality business questions, not merely display
    numbers.

  -----------------------------------------------------------------------
  Dashboard                           Questions it should answer
  ----------------------------------- -----------------------------------
  Sales                               How much did we sell today, this
                                      week and this month?

  Product                             Which items sell most, least and at
                                      what times?

  Category                            Which categories drive revenue?

  Dining Table/Dining Area            Which dining dining tables/sections
                                      generate hospitality business and
                                      where are bottlenecks?

  Kitchen                             Which items/stations are slow or
                                      overloaded?

  Payments                            How was money collected and where
                                      are variances?

  Discounts                           How much revenue was discounted and
                                      by whom?

  Guests                              Who are repeat/high-value guests?

  Stock Control                       What is low, wasted or overused?

  Procurement                         Where is procurement spend going?

  Operating Costs                     What are the major operating costs?

  Team                                Where are operational patterns or
                                      workload imbalances?
  -----------------------------------------------------------------------

-   Daily closing report --- sales, discounts, taxes, payment breakup,
    refunds, voids and cash variance.
-   Item performance --- quantity, revenue, discount impact and trend.
-   Kitchen performance --- average preparation time and late-service
    request rate.
-   Manager exceptions --- high discounts, cancellations, refunds, stock
    adjustments and unusual activity. \# 27. Module V --- Alerts &
    Messaging
-   Operational --- ready service request, delayed service request,
    booking arrival, low stock.
-   Manager --- refund, high discount, cash variance, unusual voids.
-   Guest --- booking confirmation, service status, digital receipt,
    feedback request where enabled.
-   Channel control --- in-app first; WhatsApp/SMS/email integrations
    can be enabled later. \# 28. Module W --- Control & Activity History
    This is invisible to most team but critical for a commercial
    product.
-   Who changed what --- user, action, date/time and affected record.
-   Discount activity history --- discount amount, reason and approving
    person.
-   Void/cancel activity history --- reason and authorization.
-   Refund activity history --- original payment, refund amount and
    approver.
-   Stock adjustment activity history --- before/after quantity and
    reason.
-   Settings activity history --- tax, price, permission and
    configuration changes.
-   Pass Controlrt activity history --- sensitive reports exported by
    whom. \# 29. Role-Based UX Architecture

  -----------------------------------------------------------------------
  User                    Home screen should show Primary action
  ----------------------- ----------------------- -----------------------
  Owner                   Today sales, payment    Understand hospitality
                          mix, alerts, location   business
                          snapshot                

  Manager                 Open dining dining      Run shift
                          tables, kitchen delays, 
                          bookings, exceptions    

  Service Associate       Dining Area/dining      Take service requests
                          table status and        
                          assigned dining dining  
                          tables                  

  Kitchen Team            Kitchen Operations      Prepare food
                          Screen queue, timers,   
                          station load            

  Checkout Associate      Open checkouts, payment Close checkouts
                          options, cash status    

  Host                    Bookings, queue         Seat guests
                          management, dining area 
                          availability            

  Stock Control team      Low stock, pending      Keep stock healthy
                          purchases, receiving    

  Accountant              Operating Costs, shift  Reconcile finances
                          reconciliations,        
                          reports                 
  -----------------------------------------------------------------------

# 30. The Ideal Restaurant Day --- End-to-End Journey

1.  Opening --- manager starts the location/shift, checks opening cash,
    sees bookings and operational alerts.
2.  Pre-service --- menu availability is confirmed; sold-out items are
    disabled; production areas are ready.
3.  Guest arrival --- host seats the guest or service associate opens a
    guest session.
4.  Service Request taking --- service associate selects dining table,
    adds items and preference / add-ons, confirms the service request.
5.  Kitchen execution --- items route automatically to relevant
    stations.
6.  Preparation --- chef changes item status; timers highlight slow
    service requests.
7.  Service --- service associate sees ready items, serves them and
    marks them served where required.
8.  Additional service round --- new items are added to the existing
    guest session.
9.  Checkout --- checkout associate opens the checkout, applies
    authorized discount/service charge/tax and chooses payment.
10. Shift Reconciliation --- payment is recorded, receipt is
    printed/sent, dining table becomes available for reset.
11. Closing --- checkout associate closes shift reconciliation; manager
    reviews sales, payment variance, refunds, discounts and exceptions.
12. Post-day intelligence --- owner reviews sales, best items, kitchen
    performance, guest behavior and operating costs. \# 31. Guest
    Session Concept A key product decision should be to treat the guest
    session as the central restaurant object. Instead of thinking only
    in terms of individual service requests, Nexus should understand the
    full guest visit. Example: Dining Table 12 opens at 8:05 PM. Round 1
    is placed at 8:12 PM. Round 2 is placed at 8:48 PM. One item is
    cancelled at 8:52 PM. Dessert is added at 9:20 PM. The guest asks
    for a split checkout at 9:42 PM. All of this belongs to one guest
    session with a complete timeline.

-   Guest count
-   Assigned service associate
-   Booking reference if applicable
-   All service rounds
-   Item statuses
-   Discounts/adjustments
-   Payments
-   Final checkout
-   Session timeline

  -----------------------------------------------------------------------
  Why this matters`<br>`{=html}This single concept makes dining table
  service, kitchen coordination, checkouting, reporting and guest history
  easier to understand and much harder to break.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

# 32. Manhar Nexus --- Advanced Features Beyond the Reference

  -----------------------------------------------------------------------
  Capability              Why it matters          Priority
  ----------------------- ----------------------- -----------------------
  Smart service request   Automatically routes    NOW
  routing                 items to correct        
                          kitchen/bar/station     

  Course firing           Controls when different NEXT
                          courses enter kitchen   

  Kitchen workload        Shows overloaded        NEXT
  visibility              stations and late       
                          service requests        

  Item sold-out sync      Sold-out item           NOW
                          disappears from         
                          configured channels     

  Smart preference /      Prevents incomplete or  NOW
  add-on logic            invalid service         
                          requests                

  Split/merge/transfer    Handles real-world      NOW
  everywhere              dining table and        
                          checkouting changes     

  Manager exception       Surfaces refunds,       NEXT
  center                  voids, high discounts,  
                          delays                  

  Guest preference memory Improves repeat service NEXT

  Scheduled menu changes  Automates future        NEXT
                          pricing/availability    
                          changes                 

  Unified menu across     Service Console, QR and NEXT
  channels                direct digital service  
                          requesting use one menu 

  Operational alerts      Warns before issues     NEXT
                          become complaints       

  Location comparison     Owner sees performance  LATER
                          across locations        

  AI insights             Explain anomalies and   LATER
                          suggest actions         
  -----------------------------------------------------------------------

# 33. Manager Exception Center

Instead of forcing managers to inspect every transaction, Nexus should
surface exceptions. - Large discount applied - Checkout voided after
kitchen preparation started - Refund issued - Cash Counter variance -
Unusually long kitchen service request - Item repeatedly cancelled -
Stock Control adjustment above threshold - Booking no-show pattern -
Location sales significantly below normal This is a strong future
differentiator because management software should reduce managerial
attention, not increase it. \# 34. Configuration Engine --- What the
Owner Should Control

  -----------------------------------------------------------------------
  Configuration area                  Examples
  ----------------------------------- -----------------------------------
  Menu                                categories, items, variants,
                                      preference / add-ons, prices,
                                      availability

  Dining Dining Tables                dining area, capacity, sections,
                                      dining table labels

  Kitchen                             stations, routing, preparation
                                      targets, status workflow

  Checkout & Invoicing                taxes, service charge, rounding,
                                      invoice format

  Discounts                           who can apply, limits, approval
                                      rules

  Payments                            enabled payment options, default
                                      payment option, shift
                                      reconciliation rules

  Access Roles                        access rules and approval levels

  Printing                            receipt and production printer
                                      routing

  Bookings                            slot duration, capacity,
                                      cancellation rules

  Stock Control                       units, thresholds, recipes and
                                      stock rules

  Alerts & Messaging                  which event triggers which
                                      notification

  Branding                            logo, receipt, scan menu,
                                      guest-facing identity
  -----------------------------------------------------------------------

# 35. Restaurant Type Presets

Instead of making the owner select 100 switches, Nexus should provide
presets that can then be customized.

  -----------------------------------------------------------------------
  Preset                              Recommended modules
  ----------------------------------- -----------------------------------
  Small Café                          Menu + Service Console + Dining
                                      Dining Tables + Checkout &
                                      Invoicing + Payments + Receipt

  Dine-in Restaurant                  Café preset + Kitchen Operations
                                      Screen + Guests + Bookings + Team

  QSR                                 Service Console + Menu + Kitchen
                                      Operations Screen + Checkout &
                                      Invoicing + Kitchen +
                                      Pickup/Dispatch

  Cloud Kitchen                       Menu + Service Requests + Kitchen
                                      Operations Screen + Stock Control +
                                      Procurement + Dispatch

  Premium Restaurant                  Dine-in + Bookings + Guest
                                      Relationship + Guest Rewards +
                                      Advanced Hospitality Business
                                      Intelligence

  Multi-Location Restaurant           All relevant modules +
                                      Multi-Location + Central Menu +
                                      Location Hospitality Business
                                      Intelligence
  -----------------------------------------------------------------------

# 36. Recommended Product Roadmap

  -----------------------------------------------------------------------
  Stage                   Modules                 Reason
  ----------------------- ----------------------- -----------------------
  NOW / MVP               Hospitality Business    Core revenue-producing
                          setup, access roles,    restaurant workflow
                          menu, dining dining     
                          tables, service         
                          associate Service       
                          Console, service        
                          requests, Kitchen       
                          Operations Screen,      
                          checkouting, payments,  
                          printing                

  MVP+                    Guests, bookings,       Makes the system
                          operating costs, team,  operationally complete
                          shift attendance, daily 
                          closing reports         

  NEXT                    Stock Control, recipes, Adds retention and
                          procurement, vendors,   operational depth
                          scan menu, digital      
                          service requesting,     
                          offers & rewards        

  GROWTH                  Online service          Adds channels and
                          requesting, dispatch,   management value
                          guest rewards, advanced 
                          hospitality business    
                          intelligence, location  
                          management              

  LATER                   AI insights, advanced   Differentiation after
                          payroll, accounting     real usage data
                          integrations, deep      
                          automation              
  -----------------------------------------------------------------------

# 37. What NOT to Build in the First Restaurant Version

-   Full HR suite
-   Complex accounting/ledger system
-   Advanced payroll with every statutory edge case
-   Custom dispatch fleet management
-   Large marketing automation suite
-   AI everywhere
-   Microservices or distributed architecture as a product feature
-   Dozens of reports nobody asked for
-   Separate menu systems for Service Console/QR/direct digital service
    requesting
-   A giant admin panel where every role sees everything

  -----------------------------------------------------------------------
  Hard reality`<br>`{=html}The first paying restaurants do not need the
  largest feature list. They need service requests to reach the kitchen,
  food to be prepared correctly, checkouts to be accurate, payments to
  reconcile, and managers to trust the numbers.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

# 38. Packaging & Commercialization Idea

  -----------------------------------------------------------------------
  Package                 Target guest            Core modules
  ----------------------- ----------------------- -----------------------
  Nexus Café              Small café / bakery     Menu + Service
                                                  Console + Checkout &
                                                  Invoicing + Payments +
                                                  Dining Dining Tables

  Nexus Restaurant        Standard dine-in        Café + Kitchen
                                                  Operations Screen +
                                                  Guests + Team + Reports

  Nexus Pro               High-volume restaurant  Restaurant + Stock
                                                  Control + Procurement +
                                                  Bookings + QR

  Nexus Multi-Location    Growing chain           Pro + Multi-Location +
                                                  Central Controls +
                                                  Advanced Hospitality
                                                  Business Intelligence

  Add-on Modules          Specific needs          Guest Rewards, Direct
                                                  Digital Service
                                                  Requests, Dispatch,
                                                  Advanced Stock Control,
                                                  etc.
  -----------------------------------------------------------------------

Commercial model can be subscription-led with optional setup/onboarding,
hardware/device configuration, premium support and justified custom
work. The exact pricing should be validated against local Gujarat/India
restaurant willingness-to-pay rather than guessed from software feature
count. \# 39. Trust & Operational Safety --- Product-Level Rules - A
service associate cannot see or edit owner-level financial settings. - A
chef should not need access to guest financial information. - A checkout
associate cannot silently erase a payment. - A cancelled/voided
transaction remains traceable. - Discounts above configured limits
require authorization. - Refunds have a reason and accoundining table
user. - A location user only works inside permitted location scope. -
Configuration changes are visible in history. - A failed payment must
not falsely close the checkout. - A duplicate tap should not create
duplicate service requests. - A network interruption should not cause
team to lose the service request they were entering. - The system should
clearly distinguish pending, completed and failed actions. \# 40. Screen
Architecture --- Recommended Navigation Keep navigation role-aware. Do
not show the same 25-module sidebar to every employee.

  -----------------------------------------------------------------------
  Area                                Primary screens
  ----------------------------------- -----------------------------------
  Owner / Admin                       Dashboard, Sales, Operations,
                                      Guests, Stock Control, Purchases,
                                      Operating Costs, Team, Reports,
                                      Settings

  Manager                             Live Dining Area, Service Requests,
                                      Kitchen Operations Screen Overview,
                                      Checkout & Invoicing Monitor,
                                      Bookings, Exceptions, Shift Close

  Service Associate                   My Dining Dining Tables, Dining
                                      Area, New Service Request, Active
                                      Service Requests, Ready Items

  Kitchen Team                        Kitchen Queue, Station, Delayed,
                                      Ready/Pass Control

  Checkout Associate                  Open Checkouts, Checkout, Payments,
                                      Receipt Reissue, Cash Shift

  Host                                Bookings, Queue Management, Dining
                                      Area, Seating

  Stock Control                       Stock, Low Stock, Purchases,
                                      Receiving, Vendors, Adjustments
  -----------------------------------------------------------------------

# 41. Dashboard Philosophy

The dashboard should not become a data museum. Each dashboard must
answer what the user needs to do next. - Owner --- What is happening in
my hospitality business? - Manager --- What needs my attention right
now? - Service Associate --- Which dining table/service request needs
action? - Kitchen Team --- What should I prepare next? - Checkout
Associate --- Which checkouts need to be closed? - Stock Control ---
What do I need to replenish? \# 42. Real-World Scenario Library

  -----------------------------------------------------------------------
  Scenario                            Expected Nexus behavior
  ----------------------------------- -----------------------------------
  Scenario 1 --- Normal dine-in       Dining Table opens → service
                                      request taken → kitchen prepares →
                                      service associate serves →
                                      additional item added → checkout →
                                      UPI payment → receipt → dining
                                      table reset.

  Scenario 2 --- Item unavailable     Kitchen Team marks Paneer Tikka
                                      unavailable → item is immediately
                                      blocked in service associate/QR
                                      channels → active service requests
                                      remain visible → service associate
                                      can suggest replacement.

  Scenario 3 --- Split checkout       Four guests at one dining table →
                                      select items per guest → create
                                      four payment groups → each pays
                                      separately → one guest session
                                      closes.

  Scenario 4 --- Wrong item service   Service Associate requests
  requested                           cancellation → if kitchen has not
                                      started, cancel directly; if
                                      preparation started, require
                                      configured approval/reason →
                                      activity history remains.

  Scenario 5 --- Second round         Guest service requests dinner →
                                      later adds dessert → dessert is
                                      sent to dessert station → same
                                      guest session → same final
                                      checkout.

  Scenario 6 --- Busy kitchen         Kitchen Operations Screen shows 18
                                      active items → beverage station
                                      becomes overloaded → manager sees
                                      delay → priority/queue management
                                      helps recover service.

  Scenario 7 --- Cash mismatch        Checkout Associate closes shift →
                                      expected cash differs from counted
                                      cash → variance is recorded →
                                      manager reviews rather than editing
                                      history.

  Scenario 8 --- Booking arrival      Guest arrives → booking becomes
                                      seated guest session → assigned
                                      dining table becomes occupied →
                                      service requesting starts without
                                      duplicate data entry.
  -----------------------------------------------------------------------

# 43. Product Success Criteria

  -----------------------------------------------------------------------
  Area                                Success condition
  ----------------------------------- -----------------------------------
  Service Associate                   New service associate can place a
                                      normal service request with minimal
                                      training.

  Kitchen                             Kitchen Team can understand queue
                                      and status without calling the
                                      dining area repeatedly.

  Checkout & Invoicing                Checkout Associate can close a
                                      normal checkout in seconds, not
                                      minutes.

  Owner                               Owner can understand today's
                                      hospitality business without asking
                                      team to prepare a spreadsheet.

  Configuration                       Manager can change
                                      menu/price/availability without
                                      developer intervention.

  Control                             Every sensitive adjustment has
                                      accountability.

  Scalability                         The same product model works for
                                      one location and multiple
                                      locations.

  Commercial                          Guests can buy only the modules
                                      they actually need.
  -----------------------------------------------------------------------

# 44. Final Manhar Nexus Restaurant Blueprint

The ideal restaurant implementation can be visualized as the following
operating chain: BUSINESS FOUNDATION → MENU → FLOOR/TABLES → CAPTAIN
Service Console → ORDER ENGINE → KITCHEN/Kitchen Operations Screen →
SERVICE → BILLING → PAYMENT → CUSTOMER → REPORTING Around this core sit
optional operational modules: RESERVATIONS, INVENTORY, PURCHASES,
SUPPLIERS, EXPENSES, STAFF, ATTENDANCE, QR ORDERING, ONLINE ORDERING,
DELIVERY, LOYALTY and MULTI-BRANCH. This gives Manhar Nexus a clean
commercial architecture: the operational core is always reliable;
modules extend the platform; configuration adapts it to each restaurant;
integrations connect it to external services; custom development is used
only when a justified hospitality business case exists. \# 45.
Recommended Build/Validation Sequence --- Product, Not Technical 1.
Validate with 3--5 real restaurants --- map their exact dining
table/service request/checkouting/kitchen workflow before freezing the
first UI. 1. Build the core restaurant journey first --- dining table →
service request → kitchen → ready → checkout → payment. 1. Test in a
real rush --- lunch/dinner peak is more valuable than a quiet demo. 1.
Add operational controls --- discounts, cancellations, refunds, cash
shift reconciliation, access roles. 1. Add management modules ---
guests, operating costs, team, reports. 1. Add retention modules ---
stock control, procurement, QR, bookings, guest rewards. 1. Add growth
channels --- direct digital service requesting, dispatch and
multi-location. 1. Add intelligence --- exception center and AI insights
only after reliable data exists. \# 46. Final Product Positioning

  -----------------------------------------------------------------------
  Manhar Nexus`<br>`{=html}A modular hospitality operating platform that
  connects the entire restaurant---from dining table and service request
  to kitchen, checkouting, team, stock control and management---while
  allowing every hospitality business to configure only what it needs.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

The key differentiation is not a longer feature list than WebCheckout.
The differentiation is a better operating model: fewer clicks for team,
clearer workflows for each role, stronger control for owners, one
unified data model across channels, and configuration-driven deployment
across many hospitality businesses. This is the foundation from which
the wider Manhar Nexus hospitality platform can later expand into
hotels, resorts, lodges, banquets and other hospitality operations
without creating separate software products. \# Appendix A --- Module
Priority Matrix

  ------------------------------------------------------------------------------
  Module         Priority       Revenue value  Complexity     Recommendation
  -------------- -------------- -------------- -------------- ------------------
  Menu           Must Have      High           Low            Build first

  Dining Dining  Must Have      High           Medium         Build first
  Tables                                                      

  Service        Must Have      Very High      Medium         Build first
  Associate                                                   
  Service                                                     
  Console                                                     

  Service        Must Have      Very High      High           Core engine
  Requests                                                    

  Kitchen        Must Have      High           High           Core
  Operations                                                  differentiator
  Screen                                                      

  Checkout &     Must Have      Very High      Medium         Core revenue flow
  Invoicing                                                   

  Payments       Must Have      Very High      High           Build with control

  Printing       Must Have      Medium         Medium         Local deployment
                                                              critical

  Access Roles   Must Have      High           Medium         Security/control

  Guests         Important      Medium         Medium         Post-MVP

  Bookings       Important      Medium         Medium         Restaurant segment
                                                              dependent

  Operating      Important      Medium         Low            Useful management
  Costs                                                       layer

  Team/Shift     Important      Medium         Medium         Add after core
  Attendance                                                  

  Stock Control  Important      High           High           Optional module

  Procurement    Important      High           High           Pair with stock
                                                              control

  Scan Menu      Important      Medium         Medium         Growth module

  Direct Digital Growth         High           High           Later
  Service                                                     
  Requests                                                    

  Guest Rewards  Growth         Medium         Medium         Later

  Dispatch       Growth         High           High           Later

  AI Insights    Future         Potentially    High           Only after data
                                High                          maturity
  ------------------------------------------------------------------------------

# Appendix B --- Core Terminology

  -----------------------------------------------------------------------
  Term                                Meaning in Nexus
  ----------------------------------- -----------------------------------
  Hospitality Business                The guest organization using Nexus.

  Location                            A physical operating location of a
                                      hospitality business.

  Guest Session                       The complete guest visit from
                                      seating/opening through final shift
                                      reconciliation.

  Service Request                     A group of requested items
                                      associated with a session/channel.

  Service Round                       A distinct addition to an existing
                                      guest session.

  Service Line                        One menu item within an service
                                      request.

  Preference / Add-on                 A configurable choice or add-on
                                      attached to an item.

  Kitchen Operations Screen           Kitchen Operations Screen used to
                                      execute and track preparation.

  Payment option                      A configured payment option.

  Void                                Controlled cancellation/removal of
                                      a transaction or item before/after
                                      specific states.

  sold-out                            Restaurant shorthand for
                                      unavailable/sold-out item.

  Shift Reconciliation                Closing and reconciling a
                                      checkout/payment or checkout
                                      associate shift.
  -----------------------------------------------------------------------
