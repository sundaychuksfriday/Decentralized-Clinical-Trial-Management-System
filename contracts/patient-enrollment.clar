;; Patient Enrollment Contract
;; Manages participant consent and eligibility for clinical trials

;; Define data variables
(define-data-var admin principal tx-sender)
(define-map participants
  { participant-id: (string-ascii 36) }
  {
    principal-id: principal,
    consent-provided: bool,
    eligibility-status: bool,
    enrollment-date: uint,
    trial-id: (string-ascii 36)
  }
)
(define-map trials
  { trial-id: (string-ascii 36) }
  {
    trial-name: (string-ascii 100),
    is-active: bool,
    start-date: uint,
    end-date: uint
  }
)

;; Error codes
(define-constant ERR_UNAUTHORIZED u1)
(define-constant ERR_ALREADY_ENROLLED u2)
(define-constant ERR_TRIAL_INACTIVE u3)
(define-constant ERR_NOT_FOUND u4)

;; Read-only functions
(define-read-only (get-participant (participant-id (string-ascii 36)))
  (map-get? participants { participant-id: participant-id })
)

(define-read-only (get-trial (trial-id (string-ascii 36)))
  (map-get? trials { trial-id: trial-id })
)

(define-read-only (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Public functions
(define-public (register-trial
    (trial-id (string-ascii 36))
    (trial-name (string-ascii 100))
    (start-date uint)
    (end-date uint))
  (begin
    (asserts! (is-admin) (err ERR_UNAUTHORIZED))
    (map-set trials
      { trial-id: trial-id }
      {
        trial-name: trial-name,
        is-active: true,
        start-date: start-date,
        end-date: end-date
      }
    )
    (ok true)
  )
)

(define-public (enroll-participant
    (participant-id (string-ascii 36))
    (trial-id (string-ascii 36)))
  (let ((trial (get-trial trial-id)))
    (asserts! (is-some trial) (err ERR_NOT_FOUND))
    (asserts! (get is-active (unwrap-panic trial)) (err ERR_TRIAL_INACTIVE))
    (asserts! (is-none (get-participant participant-id)) (err ERR_ALREADY_ENROLLED))

    (map-set participants
      { participant-id: participant-id }
      {
        principal-id: tx-sender,
        consent-provided: false,
        eligibility-status: false,
        enrollment-date: block-height,
        trial-id: trial-id
      }
    )
    (ok true)
  )
)

(define-public (provide-consent (participant-id (string-ascii 36)))
  (let ((participant (get-participant participant-id)))
    (asserts! (is-some participant) (err ERR_NOT_FOUND))
    (asserts! (is-eq tx-sender (get principal-id (unwrap-panic participant))) (err ERR_UNAUTHORIZED))

    (map-set participants
      { participant-id: participant-id }
      (merge (unwrap-panic participant) { consent-provided: true })
    )
    (ok true)
  )
)

(define-public (set-eligibility
    (participant-id (string-ascii 36))
    (is-eligible bool))
  (begin
    (asserts! (is-admin) (err ERR_UNAUTHORIZED))
    (let ((participant (get-participant participant-id)))
      (asserts! (is-some participant) (err ERR_NOT_FOUND))

      (map-set participants
        { participant-id: participant-id }
        (merge (unwrap-panic participant) { eligibility-status: is-eligible })
      )
      (ok true)
    )
  )
)

(define-public (set-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR_UNAUTHORIZED))
    (var-set admin new-admin)
    (ok true)
  )
)
