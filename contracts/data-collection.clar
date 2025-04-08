;; Data Collection Contract
;; Securely stores trial results and observations

;; Define data variables
(define-data-var admin principal tx-sender)
(define-map data-points
  {
    participant-id: (string-ascii 36),
    data-point-id: (string-ascii 36)
  }
  {
    data-type: (string-ascii 36),
    value: (string-utf8 1000),
    collection-date: uint,
    collected-by: principal,
    trial-id: (string-ascii 36),
    data-hash: (buff 32)
  }
)

(define-map data-types
  { type-id: (string-ascii 36) }
  {
    type-name: (string-ascii 100),
    format: (string-ascii 36),
    units: (optional (string-ascii 20)),
    validation-rules: (optional (string-utf8 500))
  }
)

;; Error codes
(define-constant ERR_UNAUTHORIZED u1)
(define-constant ERR_NOT_FOUND u4)
(define-constant ERR_INVALID_DATA u6)

;; Read-only functions
(define-read-only (get-data-point (participant-id (string-ascii 36)) (data-point-id (string-ascii 36)))
  (map-get? data-points { participant-id: participant-id, data-point-id: data-point-id })
)

(define-read-only (get-data-type (type-id (string-ascii 36)))
  (map-get? data-types { type-id: type-id })
)

(define-read-only (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Public functions
(define-public (register-data-type
    (type-id (string-ascii 36))
    (type-name (string-ascii 100))
    (format (string-ascii 36))
    (units (optional (string-ascii 20)))
    (validation-rules (optional (string-utf8 500))))
  (begin
    (asserts! (is-admin) (err ERR_UNAUTHORIZED))
    (map-set data-types
      { type-id: type-id }
      {
        type-name: type-name,
        format: format,
        units: units,
        validation-rules: validation-rules
      }
    )
    (ok true)
  )
)

(define-public (record-data-point
    (participant-id (string-ascii 36))
    (data-point-id (string-ascii 36))
    (data-type (string-ascii 36))
    (value (string-utf8 1000))
    (trial-id (string-ascii 36))
    (data-hash (buff 32)))
  (let ((type (get-data-type data-type)))
    (asserts! (is-some type) (err ERR_NOT_FOUND))

    (map-set data-points
      { participant-id: participant-id, data-point-id: data-point-id }
      {
        data-type: data-type,
        value: value,
        collection-date: block-height,
        collected-by: tx-sender,
        trial-id: trial-id,
        data-hash: data-hash
      }
    )
    (ok true)
  )
)

(define-public (update-data-point
    (participant-id (string-ascii 36))
    (data-point-id (string-ascii 36))
    (value (string-utf8 1000))
    (data-hash (buff 32)))
  (let ((data-point (get-data-point participant-id data-point-id)))
    (asserts! (is-some data-point) (err ERR_NOT_FOUND))
    (asserts! (is-eq tx-sender (get collected-by (unwrap-panic data-point))) (err ERR_UNAUTHORIZED))

    (map-set data-points
      { participant-id: participant-id, data-point-id: data-point-id }
      (merge (unwrap-panic data-point)
        {
          value: value,
          data-hash: data-hash
        }
      )
    )
    (ok true)
  )
)

(define-public (set-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR_UNAUTHORIZED))
    (var-set admin new-admin)
    (ok true)
  )
)
