;; Protocol Compliance Contract
;; Ensures adherence to study procedures

;; Define data variables
(define-data-var admin principal tx-sender)
(define-map protocol-steps
  {
    trial-id: (string-ascii 36),
    step-id: (string-ascii 36)
  }
  {
    step-name: (string-ascii 100),
    required: bool,
    sequence-order: uint,
    time-window: uint
  }
)

(define-map participant-compliance
  {
    participant-id: (string-ascii 36),
    step-id: (string-ascii 36)
  }
  {
    completed: bool,
    completion-date: uint,
    verified-by: (optional principal),
    notes: (optional (string-utf8 500))
  }
)

;; Error codes
(define-constant ERR_UNAUTHORIZED u1)
(define-constant ERR_NOT_FOUND u4)
(define-constant ERR_INVALID_STEP u5)

;; Read-only functions
(define-read-only (get-protocol-step (trial-id (string-ascii 36)) (step-id (string-ascii 36)))
  (map-get? protocol-steps { trial-id: trial-id, step-id: step-id })
)

(define-read-only (get-participant-compliance (participant-id (string-ascii 36)) (step-id (string-ascii 36)))
  (map-get? participant-compliance { participant-id: participant-id, step-id: step-id })
)

(define-read-only (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Public functions
(define-public (add-protocol-step
    (trial-id (string-ascii 36))
    (step-id (string-ascii 36))
    (step-name (string-ascii 100))
    (required bool)
    (sequence-order uint)
    (time-window uint))
  (begin
    (asserts! (is-admin) (err ERR_UNAUTHORIZED))
    (map-set protocol-steps
      { trial-id: trial-id, step-id: step-id }
      {
        step-name: step-name,
        required: required,
        sequence-order: sequence-order,
        time-window: time-window
      }
    )
    (ok true)
  )
)

(define-public (record-step-completion
    (participant-id (string-ascii 36))
    (trial-id (string-ascii 36))
    (step-id (string-ascii 36))
    (notes (optional (string-utf8 500))))
  (let ((step (get-protocol-step trial-id step-id)))
    (asserts! (is-some step) (err ERR_NOT_FOUND))

    (map-set participant-compliance
      { participant-id: participant-id, step-id: step-id }
      {
        completed: true,
        completion-date: block-height,
        verified-by: none,
        notes: notes
      }
    )
    (ok true)
  )
)

(define-public (verify-step-completion
    (participant-id (string-ascii 36))
    (step-id (string-ascii 36)))
  (begin
    (asserts! (is-admin) (err ERR_UNAUTHORIZED))
    (let ((compliance (get-participant-compliance participant-id step-id)))
      (asserts! (is-some compliance) (err ERR_NOT_FOUND))
      (asserts! (get completed (unwrap-panic compliance)) (err ERR_INVALID_STEP))

      (map-set participant-compliance
        { participant-id: participant-id, step-id: step-id }
        (merge (unwrap-panic compliance) { verified-by: (some tx-sender) })
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
