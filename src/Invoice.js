import * as Yup from 'yup';
import { ErrorMessage, Field, FieldArray, Form, Formik } from 'formik';
import React, { Fragment, useRef, useState, useEffect } from 'react';

import TextareaAutosize from 'react-textarea-autosize';
import kebabCase from 'lodash/kebabCase';
import logo from './Final-cut.png';
import { useLocalStorage } from './hooks';
import { useReactToPrint } from 'react-to-print';
import { db } from './firestore';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';

const formatter = Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
});

const ExpandingText = ({ field, form, ...props }) => {
  return <TextareaAutosize {...field} {...props} className="textarea" />;
};

const tax = {
  _: { gst: 0, pst: 0, hst: 0 },
  NONE: { gst: 0, pst: 0, hst: 0 },
  AB: { gst: 0.05, pst: 0, hst: 0 },
  BC: { gst: 0.05, pst: 0.07, hst: 0 },
  MB: { gst: 0.05, pst: 0.07, hst: 0 },
  NB: { gst: 0, pst: 0, hst: 0.15 },
  NL: { gst: 0, pst: 0, hst: 0.15 },
  NT: { gst: 0.05, pst: 0, hst: 0 },
  NS: { gst: 0, pst: 0, hst: 0.15 },
  NU: { gst: 0.05, pst: 0, hst: 0 },
  ON: { gst: 0, pst: 0, hst: 0.13 },
  PE: { gst: 0, pst: 0, hst: 0.15 },
  QC: { gst: 0.05, pst: 0.09975, hst: 0 },
  SK: { gst: 0.05, pst: 0.06, hst: 0 },
  YT: { gst: 0.05, pst: 0, hst: 0 },
};

const Invoice = () => {
  const tableRef = useRef();
  const [showPst, setShowPst] = useState(null);
  const [pst, setPst] = useState(0);
  const [gst, setGst] = useState(0);
  const [total, setTotal] = useState(null);
  const [address, saveAddress] = useLocalStorage(
    'address',
    'Pentagon Millwork Ltd. \n24 Woodfern drive SW \n T2W4E4 \n (403) 555-6677'
  );
  const [addr, setAddr] = useState(address);
  const [invoice, saveInvoice] = useLocalStorage('invoice', '077260');
  const [invoiceNo, setInvoiceNo] = useState(`0${parseInt(invoice) + 1}`);
  const [client, saveClient] = useLocalStorage('client', '');
  const [docId, setDocId] = useState('invoice');

  const saveInvoiceEverywhere = async (invoiceNo) => {
    console.log('invoiceNo', invoiceNo);
    await saveInvoicetoDB(invoiceNo);
    await saveInvoice(invoiceNo);
    await setInvoiceNo(`0${parseInt(invoiceNo) + 1}`);
  };

  const saveInvoicetoDB = async (invoiceNo) => {
    try {
      await setDoc(doc(db, 'invoice', docId), { invoiceNo });
    } catch (error) {
      console.error('Error adding document: ', error);
      await saveInvoice(invoiceNo);
    }
  };
  const getInvoiceFromDB = async () => {
    try {
      await getDocs(collection(db, 'invoice')).then((querySnapshot) => {
        const newData = querySnapshot.docs.reduce((acc, doc) => {
          return (acc = { id: doc.id, ...doc.data() });
        }, {});
        if (newData.invoiceNo) {
          setInvoiceNo(`0${parseInt(newData.invoiceNo) + 1}`);
          setDocId(newData.id);
        }
      });
    } catch (error) {
      console.error('Error getting documents: ', error);
    }
  };
  useEffect(() => {
    getInvoiceFromDB();
  }, []);

  const printClient = client.split('\n')?.[0] || 'client-name';
  const handlePrint = useReactToPrint({
    documentTitle: `${invoiceNo}-${kebabCase(
      printClient
    )}-${new Date().getFullYear()}`,
    content: () => tableRef.current,
  });

  const sumItUp = (values) => {
    const sum = values.items.reduce((acc, item) => {
      if (item.price && item.unit) {
        return acc + item.price * item.unit;
      } else return acc;
    }, 0);
    const pst = tax[values.province]?.pst || tax[values.province]?.hst;
    const gst = tax[values.province]?.gst;
    gst ? setGst(sum * tax[values.province]?.gst) : setGst(gst);
    setPst(sum * pst);
    setTotal(sum);
  };

  const validationSchema = Yup.object({
    soldTo: Yup.string().required('required'),
    date: Yup.date().required('required'),
    jobSite: Yup.string().required('required'),
    billingCycle: Yup.string(),
    province: Yup.string().required('required'),
    items: Yup.array().of(
      Yup.object().shape({
        desc: Yup.string().required('required').min(3, 'Too Short!'),
        price: Yup.number()
          .moreThan(0, 'invalid')
          .required('required')
          .typeError('invalid'),
        unit: Yup.number()
          .moreThan(0, 'invalid')
          .required('required')
          .typeError('invalid'),
        amount: Yup.number().typeError('invalid'),
      })
    ),
  });

  return (
    <div ref={tableRef}>
      <header>
        <div>
          <img height="200" src={logo} alt="Pentagon Millwork Ltd." />
        </div>
        <div className="address">
          <h1>Invoice</h1>
          <TextareaAutosize
            onChange={(e) => {
              setAddr(e.target.value);
            }}
            onBlur={(e) => {
              saveAddress(e.target.value);
            }}
            value={addr}
          ></TextareaAutosize>
        </div>
        <div>
          <input
            className="invoice-no"
            value={invoiceNo}
            onChange={(e) => {
              setInvoiceNo(e.target.value);
            }}
          />
        </div>
      </header>
      <Formik
        initialValues={{
          soldTo: client,
          date: '',
          jobSite: '',
          billingCycle: '',
          province: '',
          items: [
            {
              desc: '',
              price: '',
              unit: '',
              amount: '',
            },
          ],
        }}
        onSubmit={() => {
          saveInvoiceEverywhere(invoiceNo);
          handlePrint();
        }}
        validationSchema={validationSchema}
      >
        {({ values, handleChange, handleBlur, isValid }) => {
          return (
            <Form>
              <div className="sale">
                <div className="row fullwidth">
                  <label htmlFor="soldTo" className="col1">
                    <span>Sold to:</span>
                    <Field
                      name="soldTo"
                      id="soldTo"
                      component={ExpandingText}
                      className="client"
                      onBlur={(e) => {
                        handleBlur(e);
                        saveClient(e.target.value);
                      }}
                    />
                    <ErrorMessage
                      name="soldTo"
                      render={(msg) => <div className="error">{msg}</div>}
                    />
                  </label>
                </div>
                <div className="row">
                  <label htmlFor="soldTo" className="col1">
                    <span>Date:</span>
                    <Field name="date" type="date" />
                    <ErrorMessage
                      name="date"
                      render={(msg) => <div className="error">{msg}</div>}
                    />
                  </label>
                  <label htmlFor="jobSite" className="col2">
                    <span>Job site(s):</span>
                    <Field name="jobSite" component={ExpandingText} />
                    <ErrorMessage
                      name="jobSite"
                      render={(msg) => <div className="error">{msg}</div>}
                    />
                  </label>
                </div>
                <div className="row">
                  <label htmlFor="billingCycle" className="col1">
                    <span>Billing cycle:</span>
                    <Field name="billingCycle" component={ExpandingText} />
                    <ErrorMessage
                      name="billingCycle"
                      render={(msg) => <div className="error">{msg}</div>}
                    />
                  </label>
                  <label htmlFor="province" className="col2 noprint">
                    <span>
                      Province: <br />
                      <small>(to calculate tax)</small>
                    </span>
                    <Field
                      name="province"
                      as="select"
                      className="province"
                      onChange={(e) => {
                        handleChange(e);
                        if (
                          tax[e.target.value].pst === 0 &&
                          tax[e.target.value].hst === 0
                        ) {
                          setShowPst(false);
                          setPst(0);
                        } else {
                          const pst =
                            tax[e.target.value].pst || tax[e.target.value].hst;
                          setShowPst(true);
                          setPst(total * pst);
                        }
                        sumItUp({ ...values, province: e.target.value });
                      }}
                    >
                      <option value="_">Select a province</option>
                      {[
                        'NONE',
                        'AB',
                        'BC',
                        'MB',
                        'NB',
                        'NL',
                        'NS',
                        'NT',
                        'NU',
                        'ON',
                        'PE',
                        'QC',
                        'SK',
                        'YT',
                      ].map((prov) => (
                        <option key={prov} value={prov}>
                          {prov}
                        </option>
                      ))}
                    </Field>
                    <ErrorMessage
                      name="province"
                      render={(msg) => <div className="error">{msg}</div>}
                    />
                  </label>
                </div>
              </div>
              <div className="row head">
                <div className="item">Item</div>
                <div className="desc">Description</div>
                <div className="price">Price</div>
                <div className="unit">
                  Unit<sup>*</sup>
                </div>
                <div className="amount">Amount</div>
                <div className="buttons noprint">Actions</div>
              </div>

              <FieldArray
                name="items"
                render={(arrayHelpers) => (
                  <Fragment>
                    {values.items && values.items.length > 0 ? (
                      values.items.map((item, index) => {
                        // console.log("item", item, "index", index);
                        return (
                          <div key={index} className="row">
                            <div className="item">
                              <span>{index + 1}</span>
                            </div>
                            <div className="desc">
                              <Field
                                component={ExpandingText}
                                name={`items.${index}.desc`}
                              />
                              <ErrorMessage
                                name={`items.${index}.desc`}
                                render={(msg) => (
                                  <div className="error">{msg}</div>
                                )}
                              />
                            </div>
                            <div className="price">
                              <Field
                                name={`items.${index}.price`}
                                onBlur={(e) => {
                                  handleBlur(e);
                                  sumItUp(values);
                                }}
                              />
                              <ErrorMessage
                                name={`items.${index}.price`}
                                render={(msg) => (
                                  <div className="error">{msg}</div>
                                )}
                              />
                            </div>
                            <div className="unit">
                              <Field
                                name={`items.${index}.unit`}
                                onBlur={(e) => {
                                  handleBlur(e);
                                  sumItUp(values);
                                }}
                              />
                              <ErrorMessage
                                name={`items.${index}.unit`}
                                render={(msg) => (
                                  <div className="error">{msg}</div>
                                )}
                              />
                            </div>
                            <div className="amount">
                              <Field name={`items.${index}.amount`}>
                                {({
                                  field /* { name, value, onChange, onBlur } */,
                                }) => (
                                  <input
                                    disabled
                                    {...field}
                                    type="text"
                                    value={`${
                                      item.price && item.unit
                                        ? formatter.format(
                                            parseFloat(
                                              item.price * item.unit
                                            ).toFixed(2)
                                          )
                                        : 'TBD'
                                    }`}
                                  />
                                )}
                              </Field>
                            </div>
                            <div className="buttons noprint">
                              <button
                                type="button"
                                onClick={() => {
                                  arrayHelpers.remove(index);
                                  const items = values.items.splice(index, 1);
                                  sumItUp({ ...values, items });
                                }} // remove a friend from the list
                              >
                                -
                              </button>
                              <button
                                type="button"
                                onClick={() => arrayHelpers.push({})} // insert an empty string at a position
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="center">
                        <button
                          className="add-item"
                          type="button"
                          onClick={() => arrayHelpers.push({})}
                        >
                          {/* show this when user has removed all friends from the list */}
                          Add a new item
                        </button>
                      </div>
                    )}
                    <div className={`row footer smaller border`}>
                      <div className="item"></div>
                      <div className="desc"></div>
                      <div className="price"></div>
                      <div className="unit">
                        <strong>GST:</strong>
                      </div>
                      <div className="amount">
                        <strong>
                          {`${formatter.format(
                            parseFloat(gst || 0).toFixed(2)
                          )}`}
                        </strong>
                      </div>
                    </div>
                    {showPst && (
                      <div className="row footer smaller">
                        <div className="item"></div>
                        <div className="desc"></div>
                        <div className="price"></div>
                        <div className="unit">
                          <strong>PST/HST:</strong>
                        </div>
                        <div className="amount">
                          <strong>
                            {`${formatter.format(
                              parseFloat(pst || 0).toFixed(2)
                            )}`}
                          </strong>
                        </div>
                      </div>
                    )}
                    <div className="row footer smaller">
                      <div className="item"></div>
                      <div className="desc"></div>
                      <div className="price"></div>
                      <div className="unit">
                        <strong>Subtotal:</strong>
                      </div>
                      <div className="amount">
                        <strong>
                          {`${formatter.format(
                            parseFloat(total || 0).toFixed(2)
                          )}`}
                        </strong>
                      </div>
                    </div>
                    <div className="row footer border">
                      <div className="item"></div>
                      <div className="desc"></div>
                      <div className="price"></div>
                      <div className="unit">
                        <strong>Total due:</strong>
                      </div>
                      <div className="amount">
                        <strong>
                          {total
                            ? `${formatter.format(
                                parseFloat(
                                  total + (gst || 0) + (pst || 0)
                                ).toFixed(2)
                              )}`
                            : ''}
                        </strong>
                      </div>
                    </div>
                    <div className="small-print first">
                      Total due in 30 days. Overdue accounts subject to a
                      service charge of 2% per month.
                    </div>
                    <div className="small-print">
                      <sup>*</sup> hours or other unit of work
                    </div>
                    <div className="noprint cta">
                      <button
                        disabled={!isValid}
                        type="submit"
                        className={isValid ? 'valid' : 'invalid'}
                      >
                        Print Invoice
                      </button>
                    </div>
                  </Fragment>
                )}
              />
            </Form>
          );
        }}
      </Formik>
    </div>
  );
};
export default Invoice;
